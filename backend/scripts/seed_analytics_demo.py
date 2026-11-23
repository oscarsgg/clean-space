import math
from collections import Counter
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import Base, SessionLocal, engine, ensure_schema_updates
from app.core.dependencies import utcnow
from app.models import (
    AccessEvent,
    Alert,
    Cleanroom,
    Device,
    MonitoringParameter,
    SensorReading,
    User,
)
from app.services.analytics_etl import prepare_analytics_data
from app.services.ecbd import as_utc
from app.services.isolation_forest import train_isolation_forest


METRICS = (
    ("temperature", "°C"),
    ("humidity", "%"),
    ("pm25", "p/m³"),
    ("pressure", "Pa"),
)
READING_HOURS = tuple(range(0, 24, 3))
PERIOD_DAYS = (7, 14, 30)


def _reading_value(metric: str, day: int, hour: int, occupancy: int, room_offset: float) -> float:
    phase = day * 0.37 + hour * 0.61 + room_offset
    if metric == "temperature":
        value = 21.0 + room_offset + 0.8 * math.sin(phase)
        if day % 11 == 4 and hour == 12:
            value += 6.0
    elif metric == "humidity":
        value = 45.0 + 5.0 * math.sin(phase)
        if day % 13 == 7 and hour == 15:
            value -= 19.0
        elif day % 17 == 9 and hour == 9:
            value += 18.0
    elif metric == "pm25":
        value = 24.0 + occupancy * 28.0 + 4.0 * math.sin(phase)
        if day % 10 == 3 and hour == 12:
            value += 185.0
    else:
        value = 12.5 + 0.55 * math.sin(phase)
        if day % 12 == 6 and hour == 18:
            value += 5.5
    return round(value, 2)


def _reading_signature(reading: SensorReading) -> tuple:
    return (
        reading.device_id,
        reading.cleanroom_id,
        reading.metric,
        as_utc(reading.recorded_at).isoformat(),
        round(float(reading.value), 2),
        reading.unit.casefold(),
    )


def _event_signature(event: AccessEvent) -> tuple:
    return (
        event.cleanroom_id,
        as_utc(event.occurred_at).isoformat(),
        (event.direction or "").strip().upper(),
        (event.result or "").strip().upper(),
        event.user_id,
        event.source_device_id,
    )


def _get_demo_users(db: Session) -> tuple[User, list[User]]:
    users = db.scalars(select(User).order_by(User.id)).all()
    admin = next(
        (user for user in users if any(role.code == "ADMINISTRADOR" for role in user.roles)),
        None,
    )
    participants = [
        user for user in users
        if any(role.code in {"SUPERVISOR", "PERSONAL_AUTORIZADO"} for role in user.roles)
    ]
    if not admin:
        raise RuntimeError("No existe un administrador. Ejecuta primero `python -m scripts.seed_data`.")
    if not participants:
        participants = [admin]
    return admin, participants


def _generate_readings(
    db: Session,
    rooms: list[Cleanroom],
    devices: dict[int, Device],
    parameters: dict[tuple[int, str], MonitoringParameter],
    now: datetime,
) -> tuple[int, list[SensorReading]]:
    first_day = now.date() - timedelta(days=29)
    start = datetime.combine(first_day, time.min, tzinfo=timezone.utc)
    existing = db.scalars(
        select(SensorReading).where(
            SensorReading.cleanroom_id.in_([room.id for room in rooms]),
            SensorReading.recorded_at >= start,
            SensorReading.recorded_at < now,
        )
    ).all()
    counts = Counter(_reading_signature(item) for item in existing)
    records_by_signature = {_reading_signature(item): item for item in existing}
    pending: list[SensorReading] = []
    room_offsets = {room.id: index * 0.35 for index, room in enumerate(rooms)}

    for day in range(30):
        date = first_day + timedelta(days=day)
        for room in rooms:
            device = devices[room.id]
            offset = room_offsets[room.id]
            for hour in READING_HOURS:
                observed_at = datetime.combine(date, time(hour=hour), tzinfo=timezone.utc)
                if observed_at >= now:
                    continue
                occupancy = int(6 <= hour < 12) + int(9 <= hour < 15) + int(13 <= hour < 19)
                for metric, unit in METRICS:
                    value = _reading_value(metric, day, hour, occupancy, offset)
                    signature = (
                        device.id,
                        room.id,
                        metric,
                        observed_at.isoformat(),
                        value,
                        unit.casefold(),
                    )
                    reading = records_by_signature.get(signature)
                    if reading is None:
                        reading = SensorReading(
                            device_id=device.id,
                            cleanroom_id=room.id,
                            metric=metric,
                            value=value,
                            unit=unit,
                            recorded_at=observed_at,
                        )
                        pending.append(reading)
                        records_by_signature[signature] = reading
                    counts[signature] += 1

                    # Keep one exact duplicate in the synthetic history to demonstrate ETL quality checks.
                    if day == 2 and hour == 12 and metric == "pm25" and counts[signature] < 2:
                        pending.append(SensorReading(
                            device_id=device.id,
                            cleanroom_id=room.id,
                            metric=metric,
                            value=value,
                            unit=unit,
                            recorded_at=observed_at,
                        ))
                        counts[signature] += 1

    db.add_all(pending)
    db.commit()
    readings = list(records_by_signature.values())
    return len(pending), readings


def _generate_access_events(
    db: Session,
    rooms: list[Cleanroom],
    devices: dict[int, Device],
    participants: list[User],
    now: datetime,
) -> int:
    first_day = now.date() - timedelta(days=29)
    start = datetime.combine(first_day, time.min, tzinfo=timezone.utc)
    existing = db.scalars(
        select(AccessEvent).where(
            AccessEvent.cleanroom_id.in_([room.id for room in rooms]),
            AccessEvent.occurred_at >= start,
            AccessEvent.occurred_at < now,
        )
    ).all()
    counts = Counter(_event_signature(item) for item in existing)
    pending: list[AccessEvent] = []
    schedules = (
        (6, "ENTRY", 0),
        (9, "ENTRY", 1),
        (12, "EXIT", 0),
        (13, "ENTRY", 2),
        (15, "EXIT", 1),
        (19, "EXIT", 2),
    )

    for day in range(30):
        date = first_day + timedelta(days=day)
        for room_index, room in enumerate(rooms):
            device = devices[room.id]
            shift = room_index % 2
            for hour, direction, participant_index in schedules:
                event_hour = (hour + shift) % 24
                occurred_at = datetime.combine(date, time(hour=event_hour), tzinfo=timezone.utc)
                user = participants[(participant_index + room_index) % len(participants)]
                signature = (
                    room.id, occurred_at.isoformat(), direction, "ALLOWED", user.id, device.id
                )
                if counts[signature] == 0 and occurred_at < now:
                    pending.append(AccessEvent(
                        user_id=user.id,
                        cleanroom_id=room.id,
                        source_device_id=device.id,
                        direction=direction,
                        result="ALLOWED",
                        occurred_at=occurred_at,
                    ))
                    counts[signature] += 1

            denied_at = datetime.combine(date, time(hour=2 + shift), tzinfo=timezone.utc)
            denied_signature = (
                room.id, denied_at.isoformat(), "ENTRY", "DENIED", None, device.id
            )
            if denied_at < now and counts[denied_signature] == 0:
                pending.append(AccessEvent(
                    user_id=None,
                    cleanroom_id=room.id,
                    source_device_id=device.id,
                    direction="ENTRY",
                    result="DENIED",
                    denial_reason="CARD_NOT_FOUND",
                    occurred_at=denied_at,
                ))
                counts[denied_signature] += 1
                if day == 2 and counts[denied_signature] < 2:
                    pending.append(AccessEvent(
                        user_id=None,
                        cleanroom_id=room.id,
                        source_device_id=device.id,
                        direction="ENTRY",
                        result="DENIED",
                        denial_reason="CARD_NOT_FOUND",
                        occurred_at=denied_at,
                    ))
                    counts[denied_signature] += 1

    db.add_all(pending)
    db.commit()
    return len(pending)


def _generate_alerts(
    db: Session,
    readings: list[SensorReading],
    parameters: dict[tuple[int, str], MonitoringParameter],
) -> int:
    reading_ids = [reading.id for reading in readings if reading.id is not None]
    existing = set(db.scalars(
        select(Alert.reading_id).where(
            Alert.type == "OUT_OF_RANGE",
            Alert.reading_id.in_(reading_ids),
        )
    ).all()) if reading_ids else set()
    alerts = []
    for reading in readings:
        parameter = parameters.get((reading.cleanroom_id, reading.metric))
        if (
            reading.id in existing
            or parameter is None
            or parameter.min_value <= reading.value <= parameter.max_value
        ):
            continue
        is_high = reading.value > parameter.max_value
        severity = "CRITICAL" if reading.value > parameter.max_value * 1.1 else "WARNING"
        alerts.append(Alert(
            cleanroom_id=reading.cleanroom_id,
            device_id=reading.device_id,
            reading_id=reading.id,
            type="OUT_OF_RANGE",
            severity=severity,
            status="ACTIVE" if reading.recorded_at.day % 3 else "ACKNOWLEDGED",
            message=(
                f"{reading.metric} {'superó' if is_high else 'cayó por debajo de'} "
                f"el rango configurado: {reading.value} {reading.unit}."
            ),
            created_at=reading.recorded_at,
        ))
    db.add_all(alerts)
    db.commit()
    return len(alerts)


def _run_demo_analyses(db: Session, admin: User, rooms: list[Cleanroom], now: datetime) -> list[int]:
    run_ids = []
    for room in rooms:
        for days in PERIOD_DAYS:
            end = datetime.combine(now.date() + timedelta(days=1), time.min, tzinfo=timezone.utc)
            start = end - timedelta(days=days)
            prepared = prepare_analytics_data(db, admin, start, end, room.id)
            result = train_isolation_forest(db, admin, prepared["run_id"])
            run_ids.append(result.id)
    return run_ids


def run_demo_seed() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema_updates(engine)
    db: Session = SessionLocal()
    try:
        admin, participants = _get_demo_users(db)
        rooms = db.scalars(select(Cleanroom).order_by(Cleanroom.id)).all()
        if not rooms:
            raise RuntimeError("No hay cuartos configurados. Ejecuta primero `python -m scripts.seed_data`.")

        devices = {}
        parameters = {}
        for room in rooms:
            device = db.scalar(
                select(Device).where(Device.cleanroom_id == room.id).order_by(Device.id).limit(1)
            )
            if not device:
                raise RuntimeError(
                    f"El cuarto {room.code} no tiene dispositivo. Ejecuta primero `python -m scripts.seed_data`."
                )
            devices[room.id] = device
            room_parameters = db.scalars(
                select(MonitoringParameter).where(
                    MonitoringParameter.cleanroom_id == room.id,
                    MonitoringParameter.enabled.is_(True),
                )
            ).all()
            parameters.update({(room.id, item.metric): item for item in room_parameters})
            missing = {metric for metric, _unit in METRICS} - {
                item.metric for item in room_parameters
            }
            if missing:
                raise RuntimeError(
                    f"Al cuarto {room.code} le faltan parámetros habilitados: {', '.join(sorted(missing))}."
                )

        now = as_utc(utcnow())
        reading_count, readings = _generate_readings(db, rooms, devices, parameters, now)
        event_count = _generate_access_events(db, rooms, devices, participants, now)
        alert_count = _generate_alerts(db, readings, parameters)
        result_ids = _run_demo_analyses(db, admin, rooms, now)
        print(
            f"Demo de análisis lista: {reading_count} lecturas nuevas, {event_count} accesos nuevos, "
            f"{alert_count} alertas nuevas y {len(result_ids)} resultados Isolation Forest "
            f"(IDs: {', '.join(map(str, result_ids))})."
        )
    finally:
        db.close()

if __name__ == "__main__":
    run_demo_seed()
