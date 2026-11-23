import json
import logging
import math
from collections import defaultdict
from datetime import datetime
from statistics import fmean, pstdev
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import ensure_room_access, utcnow
from app.models import (
    AccessEvent,
    AnalyticsRun,
    Cleanroom,
    Device,
    MonitoringParameter,
    PreparedAnalyticsRecord,
    SensorReading,
    User,
)
from app.services.ecbd import accessible_rooms, as_utc


logger = logging.getLogger(__name__)
MAX_SOURCE_ROWS = 50_000


def _room_scope(db: Session, user: User, cleanroom_id: int | None) -> list[int] | None:
    if cleanroom_id is not None:
        if not db.get(Cleanroom, cleanroom_id):
            raise HTTPException(404, "Cuarto no encontrado")
        ensure_room_access(user, cleanroom_id)
        return [cleanroom_id]

    if "ADMINISTRADOR" in {role.code for role in user.roles}:
        return None
    return [room.id for room in accessible_rooms(db, user)]


def _scope_query(query, room_ids: list[int] | None, room_column):
    if room_ids is not None:
        query = query.where(room_column.in_(room_ids)) if room_ids else query.where(False)
    return query


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def _increment(counter: dict[str, int], key: str) -> None:
    counter[key] = counter.get(key, 0) + 1


def prepare_analytics_data(
    db: Session,
    user: User,
    start_at: datetime,
    end_at: datetime,
    cleanroom_id: int | None = None,
) -> dict[str, Any]:
    """Extract, validate, normalize and persist one reproducible analytics dataset."""
    room_ids = _room_scope(db, user, cleanroom_id)
    reading_filter = [SensorReading.recorded_at >= start_at, SensorReading.recorded_at < end_at]
    access_filter = [AccessEvent.occurred_at >= start_at, AccessEvent.occurred_at < end_at]

    reading_count_query = _scope_query(
        select(func.count(SensorReading.id)).where(*reading_filter), room_ids, SensorReading.cleanroom_id
    )
    access_count_query = _scope_query(
        select(func.count(AccessEvent.id)).where(*access_filter), room_ids, AccessEvent.cleanroom_id
    )
    source_readings = db.scalar(reading_count_query) or 0
    source_accesses = db.scalar(access_count_query) or 0
    if source_readings > MAX_SOURCE_ROWS or source_accesses > MAX_SOURCE_ROWS:
        raise HTTPException(
            422,
            f"Esta ejecución supera el límite de {MAX_SOURCE_ROWS:,} registros por fuente. Reduce el periodo o selecciona un cuarto.",
        )

    run = AnalyticsRun(
        initiated_by=user.id,
        cleanroom_id=cleanroom_id,
        status="RUNNING",
        period_start=start_at,
        period_end=end_at,
        source_readings=source_readings,
        source_accesses=source_accesses,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    try:
        parameters_query = select(MonitoringParameter).where(MonitoringParameter.enabled.is_(True))
        parameters_query = _scope_query(parameters_query, room_ids, MonitoringParameter.cleanroom_id)
        parameter_units = {
            (param.cleanroom_id, param.metric.strip().casefold()): param.unit.strip()
            for param in db.scalars(parameters_query).all()
        }

        reading_query = (
            select(SensorReading, Device.cleanroom_id)
            .outerjoin(Device, Device.id == SensorReading.device_id)
            .where(*reading_filter)
            .order_by(SensorReading.recorded_at.asc(), SensorReading.id.asc())
            .limit(MAX_SOURCE_ROWS + 1)
        )
        reading_query = _scope_query(reading_query, room_ids, SensorReading.cleanroom_id)
        source_reading_rows = db.execute(reading_query).all()

        access_query = (
            select(AccessEvent)
            .where(*access_filter)
            .order_by(AccessEvent.occurred_at.asc(), AccessEvent.id.asc())
            .limit(MAX_SOURCE_ROWS + 1)
        )
        access_query = _scope_query(access_query, room_ids, AccessEvent.cleanroom_id)
        source_access_rows = db.scalars(access_query).all()
        if len(source_reading_rows) > MAX_SOURCE_ROWS or len(source_access_rows) > MAX_SOURCE_ROWS:
            raise HTTPException(
                422,
                f"Esta ejecución supera el límite de {MAX_SOURCE_ROWS:,} registros por fuente. Reduce el periodo o selecciona un cuarto.",
            )
        source_readings = len(source_reading_rows)
        source_accesses = len(source_access_rows)
        run.source_readings = source_readings
        run.source_accesses = source_accesses

        quality: dict[str, Any] = {
            "readings": {"prepared": 0, "rejected": 0, "duplicate_candidates": 0, "rejected_by_reason": {}},
            "access_events": {"prepared": 0, "rejected": 0, "duplicate_candidates": 0, "rejected_by_reason": {}},
        }
        reading_records: list[dict[str, Any]] = []
        reading_signatures: set[tuple[Any, ...]] = set()

        for reading, device_room_id in source_reading_rows:
            section = quality["readings"]
            if device_room_id is None or device_room_id != reading.cleanroom_id:
                section["rejected"] += 1
                _increment(section["rejected_by_reason"], "dispositivo_y_cuarto_no_coinciden")
                continue
            metric = (reading.metric or "").strip().casefold()
            unit = (reading.unit or "").strip()
            if not metric or not unit:
                section["rejected"] += 1
                _increment(section["rejected_by_reason"], "variable_o_unidad_vacia")
                continue
            try:
                value = float(reading.value)
            except (TypeError, ValueError):
                value = math.nan
            if not math.isfinite(value):
                section["rejected"] += 1
                _increment(section["rejected_by_reason"], "valor_no_finito")
                continue
            configured_unit = parameter_units.get((reading.cleanroom_id, metric))
            if configured_unit and configured_unit.casefold() != unit.casefold():
                section["rejected"] += 1
                _increment(section["rejected_by_reason"], "unidad_distinta_a_la_configurada")
                continue

            observed_at = as_utc(reading.recorded_at)
            signature = (reading.device_id, reading.cleanroom_id, metric, observed_at.isoformat(), value, unit.casefold())
            if signature in reading_signatures:
                section["duplicate_candidates"] += 1
                section["rejected"] += 1
                _increment(section["rejected_by_reason"], "lectura_duplicada")
                continue
            reading_signatures.add(signature)
            reading_records.append({
                "source_id": reading.id,
                "cleanroom_id": reading.cleanroom_id,
                "observed_at": observed_at,
                "metric": metric,
                "value": value,
                "unit": unit,
            })

        grouped_values: dict[tuple[int, str, str], list[float]] = defaultdict(list)
        for item in reading_records:
            grouped_values[(item["cleanroom_id"], item["metric"], item["unit"].casefold())].append(item["value"])
        stats = {
            key: (fmean(values), pstdev(values) or 1.0)
            for key, values in grouped_values.items()
        }

        records_to_store: list[PreparedAnalyticsRecord] = []
        daily_reading_groups: dict[tuple[int, str, str, str], list[float]] = defaultdict(list)
        parameters_by_key = {
            (param.cleanroom_id, param.metric.strip().casefold()): param
            for param in db.scalars(parameters_query).all()
        }
        for item in reading_records:
            key = (item["cleanroom_id"], item["metric"], item["unit"].casefold())
            mean, std = stats[key]
            normalized = (item["value"] - mean) / std
            parameter = parameters_by_key.get((item["cleanroom_id"], item["metric"]))
            is_in_range = None
            if parameter and parameter.unit.strip().casefold() == item["unit"].casefold():
                is_in_range = parameter.min_value <= item["value"] <= parameter.max_value
            records_to_store.append(PreparedAnalyticsRecord(
                run_id=run.id,
                source_type="sensor_reading",
                source_id=item["source_id"],
                cleanroom_id=item["cleanroom_id"],
                observed_at=item["observed_at"],
                metric=item["metric"],
                value=item["value"],
                unit=item["unit"],
                normalized_value=round(normalized, 6),
                features_json=_json({
                    "hour_utc": item["observed_at"].hour,
                    "weekday_utc": item["observed_at"].weekday(),
                    "in_configured_range": is_in_range,
                }),
            ))
            day = item["observed_at"].date().isoformat()
            daily_reading_groups[(item["cleanroom_id"], day, item["metric"], item["unit"])].append(item["value"])

        access_section = quality["access_events"]
        access_signatures: set[tuple[Any, ...]] = set()
        access_groups: dict[tuple[int, str, int, str, str], int] = defaultdict(int)
        for event in source_access_rows:
            direction = (event.direction or "").strip().upper()
            result = (event.result or "").strip().upper()
            if direction not in {"ENTRY", "EXIT"}:
                access_section["rejected"] += 1
                _increment(access_section["rejected_by_reason"], "sentido_desconocido")
                continue
            if result not in {"ALLOWED", "DENIED"}:
                access_section["rejected"] += 1
                _increment(access_section["rejected_by_reason"], "resultado_desconocido")
                continue
            observed_at = as_utc(event.occurred_at)
            signature = (event.cleanroom_id, observed_at.isoformat(), direction, result, event.user_id, event.source_device_id)
            if signature in access_signatures:
                access_section["duplicate_candidates"] += 1
                access_section["rejected"] += 1
                _increment(access_section["rejected_by_reason"], "evento_duplicado")
                continue
            access_signatures.add(signature)
            category = f"{direction}:{result}"
            records_to_store.append(PreparedAnalyticsRecord(
                run_id=run.id,
                source_type="access_event",
                source_id=event.id,
                cleanroom_id=event.cleanroom_id,
                observed_at=observed_at,
                category=category,
                features_json=_json({
                    "direction": direction,
                    "result": result,
                    "hour_utc": observed_at.hour,
                    "weekday_utc": observed_at.weekday(),
                }),
            ))
            access_groups[(event.cleanroom_id, observed_at.date().isoformat(), observed_at.hour, direction, result)] += 1

        quality["readings"]["prepared"] = len(reading_records)
        quality["access_events"]["prepared"] = len(access_signatures)
        reading_daily_summary = [
            {
                "cleanroom_id": room_id,
                "date": date,
                "metric": metric,
                "unit": unit,
                "count": len(values),
                "average": round(fmean(values), 3),
                "minimum": round(min(values), 3),
                "maximum": round(max(values), 3),
            }
            for (room_id, date, metric, unit), values in sorted(daily_reading_groups.items())
        ]
        access_hourly_summary = [
            {"cleanroom_id": room_id, "date": date, "hour_utc": hour, "direction": direction, "result": result, "count": count}
            for (room_id, date, hour, direction, result), count in sorted(access_groups.items())
        ]

        for offset in range(0, len(records_to_store), 1000):
            db.add_all(records_to_store[offset:offset + 1000])
            db.flush()

        completed_at = utcnow()
        summary = {
            "run_id": run.id,
            "status": "completed",
            "scope": {"cleanroom_id": cleanroom_id, "start_at": start_at.isoformat(), "end_at": end_at.isoformat()},
            "sources": [
                {
                    "name": "sensor_readings",
                    "type": "telemetría ambiental",
                    "structure": ["id", "cleanroom_id", "device_id", "metric", "value", "unit", "recorded_at"],
                    "source_rows": source_readings,
                    "prepared_rows": len(reading_records),
                },
                {
                    "name": "access_events",
                    "type": "eventos de acceso",
                    "structure": ["id", "cleanroom_id", "source_device_id", "direction", "result", "occurred_at"],
                    "source_rows": source_accesses,
                    "prepared_rows": len(access_signatures),
                },
            ],
            "quality": quality,
            "transformations": [
                "Variables y sentidos normalizados a minúsculas/mayúsculas canónicas.",
                "Se excluyeron valores no finitos, registros sin variable/unidad, unidades incompatibles y duplicados exactos.",
                "Las lecturas se normalizaron con puntuación z dentro de cada cuarto, variable y unidad; no se imputaron valores faltantes.",
                "Se derivaron hora y día de semana UTC para lecturas y accesos.",
            ],
            "daily_reading_summary": reading_daily_summary,
            "hourly_access_summary": access_hourly_summary,
            "completed_at": completed_at.isoformat(),
        }
        run.status = "COMPLETED"
        run.prepared_readings = len(reading_records)
        run.prepared_accesses = len(access_signatures)
        run.summary_json = _json(summary)
        run.completed_at = completed_at
        db.commit()
        return {
            key: value
            for key, value in summary.items()
            if key not in {"daily_reading_summary", "hourly_access_summary"}
        }
    except Exception as exc:
        db.rollback()
        failed_run = db.get(AnalyticsRun, run.id)
        if failed_run:
            failed_run.status = "FAILED"
            failed_run.error_message = "No fue posible preparar el conjunto de datos."
            failed_run.completed_at = utcnow()
            failed_run.summary_json = _json({"run_id": failed_run.id, "status": "failed"})
            db.commit()
        logger.exception("Analytics ETL run %s failed", run.id)
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(500, "No se pudieron preparar los registros para análisis.") from exc
