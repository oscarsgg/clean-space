import json
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.dependencies import ensure_room_access, utcnow
from app.models import (
    AccessEvent,
    Alert,
    Cleanroom,
    Device,
    ModelResult,
    MonitoringParameter,
    RfidCard,
    SensorReading,
    User,
)


def as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def accessible_rooms(db: Session, user: User) -> list[Cleanroom]:
    if "ADMINISTRADOR" in {role.code for role in user.roles}:
        return list(db.scalars(select(Cleanroom).order_by(Cleanroom.id)).all())
    return sorted(user.assigned_cleanrooms, key=lambda room: room.id)


def compute_room_occupancy(
    db: Session, cleanroom_id: int, window_hours: int = 24
) -> dict[str, AccessEvent]:
    since = utcnow() - timedelta(hours=window_hours)
    events = db.scalars(
        select(AccessEvent)
        .where(
            AccessEvent.cleanroom_id == cleanroom_id,
            AccessEvent.result == "ALLOWED",
            AccessEvent.occurred_at >= since,
        )
        .order_by(AccessEvent.occurred_at.asc(), AccessEvent.id.asc())
    ).all()
    inside: dict[str, AccessEvent] = {}
    for ev in events:
        key = (
            f"user_{ev.user_id}"
            if ev.user_id
            else (
                f"emp_{ev.employee_id}"
                if getattr(ev, "employee_id", None)
                else (f"uid_{ev.rfid_uid}" if getattr(ev, "rfid_uid", None) else None)
            )
        )
        if not key:
            continue
        if ev.direction == "ENTRY":
            inside[key] = ev
        elif ev.direction == "EXIT":
            inside.pop(key, None)
    return inside


def get_supervisor_summary(
    db: Session,
    user: User,
    cleanroom_id: int | None = None,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
) -> dict[str, Any]:
    rooms = accessible_rooms(db, user)
    if cleanroom_id is not None:
        ensure_room_access(user, cleanroom_id)
        rooms = [room for room in rooms if room.id == cleanroom_id]
    room_ids = [room.id for room in rooms]
    if not room_ids:
        return {
            "total_events": 0,
            "entries": 0,
            "exits": 0,
            "denied": 0,
            "current_occupancy": 0,
            "active_alerts": 0,
            "rooms": [],
            "access_series": [],
            "environment_series": [],
        }

    event_filters = [AccessEvent.cleanroom_id.in_(room_ids)]
    if start_at is not None:
        event_filters.append(AccessEvent.occurred_at >= start_at)
    if end_at is not None:
        event_filters.append(AccessEvent.occurred_at < end_at)
    total_events = (
        db.scalar(select(func.count(AccessEvent.id)).where(*event_filters))
        or 0
    )
    entries = (
        db.scalar(
            select(func.count(AccessEvent.id)).where(
                *event_filters, AccessEvent.direction == "ENTRY"
            )
        )
        or 0
    )
    exits = (
        db.scalar(
            select(func.count(AccessEvent.id)).where(
                *event_filters, AccessEvent.direction == "EXIT"
            )
        )
        or 0
    )
    denied = (
        db.scalar(
            select(func.count(AccessEvent.id)).where(
                *event_filters, AccessEvent.result == "DENIED"
            )
        )
        or 0
    )
    active_alerts = (
        db.scalar(
            select(func.count(Alert.id)).where(
                Alert.cleanroom_id.in_(room_ids), Alert.status == "ACTIVE"
            )
        )
        or 0
    )

    room_cards: list[dict[str, Any]] = []
    total_occupancy = 0
    access_events = db.scalars(
        select(AccessEvent).where(*event_filters).order_by(AccessEvent.occurred_at.asc(), AccessEvent.id.asc())
    ).all()
    bucket_counts: dict[str, dict[str, int]] = {}
    for event in access_events:
        key = as_utc(event.occurred_at).strftime("%Y-%m-%d")
        bucket = bucket_counts.setdefault(key, {"allowed": 0, "denied": 0})
        bucket["allowed" if event.result == "ALLOWED" else "denied"] += 1
    access_series = [
        {"date": date, **counts} for date, counts in sorted(bucket_counts.items())
    ]
    readings_query = select(SensorReading).where(SensorReading.cleanroom_id.in_(room_ids))
    if start_at is not None:
        readings_query = readings_query.where(SensorReading.recorded_at >= start_at)
    if end_at is not None:
        readings_query = readings_query.where(SensorReading.recorded_at < end_at)
    readings = db.scalars(
        readings_query.order_by(SensorReading.recorded_at.asc(), SensorReading.id.asc()).limit(5000)
    ).all()
    reading_buckets: dict[tuple[str, str, str], list[float]] = {}
    for reading in readings:
        key = (as_utc(reading.recorded_at).strftime("%Y-%m-%d"), reading.metric, reading.unit)
        values = reading_buckets.setdefault(key, [0.0, 0.0])
        values[0] += float(reading.value)
        values[1] += 1
    environment_series = [
        {"date": date_key, "metric": metric, "unit": unit, "average": round(total / count, 2), "count": int(count)}
        for (date_key, metric, unit), (total, count) in sorted(reading_buckets.items())
    ]

    for room in rooms:
        inside_map = compute_room_occupancy(db, room.id)
        occupants: list[dict[str, Any]] = []
        for key, ev in inside_map.items():
            occupant_name = getattr(ev, "person_name", None)
            uid_label = getattr(ev, "rfid_uid", None) or "Autorizado"
            if ev.user_id:
                occupant_user = db.get(User, ev.user_id)
                if occupant_user:
                    occupant_name = occupant_user.full_name
                card = db.get(RfidCard, ev.rfid_card_id) if ev.rfid_card_id else None
                if not card and occupant_user:
                    card = db.scalar(
                        select(RfidCard)
                        .where(RfidCard.user_id == occupant_user.id)
                        .order_by(RfidCard.id.asc())
                    )
                if card and card.label:
                    uid_label = card.label
            elif getattr(ev, "employee_id", None):
                from app.models.employee import Employee
                emp = db.get(Employee, ev.employee_id)
                if emp:
                    occupant_name = f"{emp.firstName} {emp.lastName}"

            occupants.append(
                {
                    "user_id": ev.user_id or getattr(ev, "employee_id", 0) or 0,
                    "full_name": occupant_name or f"Personal #{key}",
                    "uid_label": uid_label,
                }
            )

        device = db.scalar(
            select(Device)
            .where(Device.cleanroom_id == room.id, Device.status == "ACTIVE")
            .order_by(Device.id.asc())
        )
        if not device:
            device = db.scalar(
                select(Device).where(Device.cleanroom_id == room.id).order_by(Device.id.asc())
            )

        params = db.scalars(
            select(MonitoringParameter).where(
                MonitoringParameter.cleanroom_id == room.id,
                MonitoringParameter.enabled.is_(True),
            )
        ).all()
        param_map = {param.metric: param for param in params}

        recent_readings = db.scalars(
            select(SensorReading)
            .where(SensorReading.cleanroom_id == room.id)
            .order_by(desc(SensorReading.recorded_at), desc(SensorReading.id))
            .limit(100)
        ).all()
        latest_by_metric: dict[str, SensorReading] = {}
        for reading in recent_readings:
            if reading.metric not in latest_by_metric:
                latest_by_metric[reading.metric] = reading

        metric_keys = sorted(set(param_map.keys()) | set(latest_by_metric.keys()))
        metrics: dict[str, Any] = {}
        for metric_name in metric_keys:
            param = param_map.get(metric_name)
            latest = latest_by_metric.get(metric_name)
            value = round(float(latest.value), 2) if latest else None
            min_val = float(param.min_value) if param else None
            max_val = float(param.max_value) if param else None
            in_range = True
            if param and latest is not None:
                in_range = param.min_value <= latest.value <= param.max_value
            metrics[metric_name] = {
                "value": value,
                "unit": param.unit if param else (latest.unit if latest else ""),
                "min_value": min_val,
                "max_value": max_val,
                "in_range": in_range,
            }

        occ_count = len(occupants)
        total_occupancy += occ_count
        door_id = "entrada-principal" if room.id == 1 else f"puerta-{room.code.lower()}"
        door_name = "Entrada Principal" if room.id == 1 else f"Puerta {room.name}"
        room_cards.append(
            {
                "id": room.id,
                "code": room.code,
                "name": room.name,
                "door_id": door_id,
                "door_name": door_name,
                "iso_class": room.iso_class,
                "capacity": room.capacity,
                "current_occupancy": occ_count,
                "device_id": device.id if device else None,
                "device_code": device.code if device else None,
                "device_status": device.status if device else "OFFLINE",
                "occupants": occupants,
                "metrics": metrics,
            }
        )

    return {
        "total_events": total_events,
        "entries": entries,
        "exits": exits,
        "denied": denied,
        "current_occupancy": total_occupancy,
        "active_alerts": active_alerts,
        "rooms": room_cards,
        "access_series": access_series,
        "environment_series": environment_series,
        "period": {
            "start_at": as_utc(start_at).isoformat() if start_at else None,
            "end_at": as_utc(end_at).isoformat() if end_at else None,
        },
    }


def compute_correlation(
    db: Session, user: User, cleanroom_id: int | None = None
) -> dict[str, Any]:
    rooms = accessible_rooms(db, user)
    if cleanroom_id is not None:
        ensure_room_access(user, cleanroom_id)
        target_ids = [cleanroom_id]
    else:
        target_ids = [rooms[0].id] if rooms else []

    if not target_ids:
        return {
            "coefficient_r": 0.0,
            "strength": "NEGLIGIBLE",
            "pm25_max_threshold": 200.0,
            "points": [],
        }

    param = db.scalar(
        select(MonitoringParameter).where(
            MonitoringParameter.cleanroom_id.in_(target_ids),
            MonitoringParameter.metric == "pm25",
            MonitoringParameter.enabled.is_(True),
        )
    )
    pm25_max_threshold = float(param.max_value) if param else 200.0

    readings = db.scalars(
        select(SensorReading)
        .where(
            SensorReading.cleanroom_id.in_(target_ids),
            SensorReading.metric == "pm25",
        )
        .order_by(SensorReading.recorded_at.asc(), SensorReading.id.asc())
        .limit(200)
    ).all()

    events = db.scalars(
        select(AccessEvent)
        .where(
            AccessEvent.cleanroom_id.in_(target_ids),
            AccessEvent.result == "ALLOWED",
            AccessEvent.user_id.is_not(None),
        )
        .order_by(AccessEvent.occurred_at.asc(), AccessEvent.id.asc())
    ).all()

    inside_users: set[tuple[int, int]] = set()
    ev_idx = 0
    points: list[dict[str, Any]] = []

    for reading in readings:
        reading_ts = as_utc(reading.recorded_at)
        while ev_idx < len(events) and as_utc(events[ev_idx].occurred_at) <= reading_ts:
            ev = events[ev_idx]
            key = (ev.cleanroom_id, ev.user_id)  # type: ignore[arg-type]
            if ev.direction == "ENTRY":
                inside_users.add(key)
            elif ev.direction == "EXIT":
                inside_users.discard(key)
            ev_idx += 1
        points.append(
            {
                "timestamp": reading_ts.isoformat(),
                "occupancy": len(inside_users),
                "pm25": round(float(reading.value), 2),
            }
        )

    r_val = 0.0
    if len(points) >= 2:
        occ_arr = np.array([p["occupancy"] for p in points], dtype=float)
        pm_arr = np.array([p["pm25"] for p in points], dtype=float)
        if np.std(occ_arr) > 0 and np.std(pm_arr) > 0:
            corr = float(np.corrcoef(occ_arr, pm_arr)[0, 1])
            if not np.isnan(corr):
                r_val = round(corr, 4)

    abs_r = abs(r_val)
    if abs_r >= 0.7:
        strength = "STRONG"
    elif abs_r >= 0.4:
        strength = "MODERATE"
    elif abs_r >= 0.2:
        strength = "WEAK"
    else:
        strength = "NEGLIGIBLE"

    return {
        "coefficient_r": r_val,
        "strength": strength,
        "pm25_max_threshold": pm25_max_threshold,
        "points": points,
    }


def compute_access_patterns(
    db: Session, user: User, cleanroom_id: int | None = None,
    start_at: datetime | None = None, end_at: datetime | None = None,
) -> list[dict[str, Any]]:
    query = select(AccessEvent.occurred_at)
    if cleanroom_id is not None:
        ensure_room_access(user, cleanroom_id)
        query = query.where(AccessEvent.cleanroom_id == cleanroom_id)
    if "ADMINISTRADOR" not in {role.code for role in user.roles}:
        room_ids = [room.id for room in user.assigned_cleanrooms]
        if not room_ids:
            return []
        query = query.where(AccessEvent.cleanroom_id.in_(room_ids))
    if start_at is not None:
        query = query.where(AccessEvent.occurred_at >= start_at)
    if end_at is not None:
        query = query.where(AccessEvent.occurred_at < end_at)

    timestamps = db.scalars(query).all()
    if not timestamps:
        return []

    counts_by_hour = Counter(as_utc(ts).hour for ts in timestamps)
    rows = sorted(counts_by_hour.items(), key=lambda item: item[0])

    if len(rows) < 3:
        max_count = max(c for _, c in rows)
        result = []
        for hour, count in rows:
            if len(rows) == 1 or count == max_count:
                cluster_code, label = "c3", "Hora Pico"
            else:
                cluster_code, label = "c1", "Baja Afluencia"
            result.append(
                {
                    "hour": hour,
                    "count": count,
                    "cluster": cluster_code,
                    "cluster_label": label,
                }
            )
        return result

    unique_counts = len({count for _, count in rows})
    if unique_counts >= 3:
        features = np.array([[count] for _, count in rows], dtype=float)
    else:
        features = np.array([[count, hour] for hour, count in rows], dtype=float)

    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    raw_labels = kmeans.fit_predict(features)

    cluster_stats: list[tuple[int, float, float]] = []
    for cid in range(3):
        members = [rows[idx] for idx, lbl in enumerate(raw_labels) if lbl == cid]
        mean_count = sum(c for _, c in members) / len(members)
        mean_hour = sum(h for h, _ in members) / len(members)
        cluster_stats.append((cid, mean_count, mean_hour))

    cluster_stats.sort(key=lambda item: (item[1], item[2]))
    tier_meta = [
        ("c1", "Baja Afluencia"),
        ("c2", "Flujo Moderado"),
        ("c3", "Pico de Acceso"),
    ]
    cid_to_meta = {
        stats[0]: tier_meta[rank] for rank, stats in enumerate(cluster_stats)
    }

    return [
        {
            "hour": hour,
            "count": count,
            "cluster": cid_to_meta[int(raw_labels[idx])][0],
            "cluster_label": cid_to_meta[int(raw_labels[idx])][1],
        }
        for idx, (hour, count) in enumerate(rows)
    ]


def train_isolation_forest(db: Session, user: User) -> ModelResult:
    query = select(SensorReading).order_by(SensorReading.recorded_at.asc(), SensorReading.id.asc())
    if "ADMINISTRADOR" not in {role.code for role in user.roles}:
        room_ids = [room.id for room in user.assigned_cleanrooms]
        if room_ids:
            query = query.where(SensorReading.cleanroom_id.in_(room_ids))
        else:
            query = query.where(SensorReading.id == -1)

    readings = db.scalars(query.limit(2000)).all()
    if len(readings) < 5:
        result = ModelResult(
            model_type="isolation_forest",
            metric="multi_metric",
            score=0.0,
            result_json=json.dumps(
                {
                    "training_rows": len(readings),
                    "anomalies_detected": 0,
                    "anomaly_rate": 0.0,
                    "status": "insufficient_data",
                    "anomalies": [],
                }
            ),
        )
        db.add(result)
        db.commit()
        db.refresh(result)
        return result

    by_metric: dict[str, list[float]] = {}
    for r in readings:
        by_metric.setdefault(r.metric, []).append(float(r.value))

    stats: dict[str, tuple[float, float]] = {}
    for metric_name, vals in by_metric.items():
        arr = np.array(vals, dtype=float)
        mean_v = float(arr.mean())
        std_v = float(arr.std()) or 1.0
        stats[metric_name] = (mean_v, std_v)

    feature_rows = []
    for r in readings:
        mean_v, std_v = stats[r.metric]
        z_val = (float(r.value) - mean_v) / std_v
        hour_norm = as_utc(r.recorded_at).hour / 23.0
        feature_rows.append([z_val, hour_norm])

    matrix = np.array(feature_rows, dtype=float)
    model = IsolationForest(contamination=0.1, random_state=42)
    preds = model.fit_predict(matrix)
    scores = model.decision_function(matrix)

    anomalies: list[dict[str, Any]] = []
    for idx, pred in enumerate(preds):
        if int(pred) == -1:
            r = readings[idx]
            anomalies.append(
                {
                    "reading_id": r.id,
                    "cleanroom_id": r.cleanroom_id,
                    "metric": r.metric,
                    "value": round(float(r.value), 2),
                    "unit": r.unit,
                    "recorded_at": as_utc(r.recorded_at).isoformat(),
                    "anomaly_score": round(float(scores[idx]), 4),
                }
            )

    anomalies.sort(key=lambda item: item["anomaly_score"])
    anomalies_detected = int((preds == -1).sum())
    anomaly_rate = round(anomalies_detected / len(readings), 4)
    mean_score = round(float(scores.mean()), 4)

    result = ModelResult(
        model_type="isolation_forest",
        metric="multi_metric",
        score=mean_score,
        result_json=json.dumps(
            {
                "training_rows": len(readings),
                "anomalies_detected": anomalies_detected,
                "anomaly_rate": anomaly_rate,
                "contamination": 0.1,
                "metrics_included": sorted(by_metric.keys()),
                "anomalies": anomalies[:20],
                "status": "trained",
            }
        ),
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result
