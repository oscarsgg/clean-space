import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.dependencies import ensure_room_access, output, require, utcnow
from app.db.database import get_db
from app.models import AccessEvent, Alert, AnalyticsRun, Cleanroom, Device, ModelResult, MonitoringParameter, PreparedAnalyticsRecord, SensorReading, User
from app.services.ecbd import (
    as_utc,
    accessible_rooms,
    compute_access_patterns,
    compute_correlation,
    get_supervisor_summary,
)
from app.services.analytics_etl import prepare_analytics_data
from app.services.isolation_forest import train_isolation_forest


router = APIRouter(tags=["Analytics"])


def dashboard_period(start_at: datetime | None, end_at: datetime | None) -> tuple[datetime, datetime]:
    end = as_utc(end_at) if end_at else utcnow()
    start = as_utc(start_at) if start_at else end - timedelta(days=7)
    if start >= end:
        raise HTTPException(422, "start_at debe ser anterior a end_at")
    if end - start > timedelta(days=366):
        raise HTTPException(422, "El periodo máximo permitido es de 366 días")
    return start, end


def serialize_etl_run(run: AnalyticsRun, include_details: bool = False) -> dict:
    summary = json.loads(run.summary_json or "{}")
    if not include_details:
        summary.pop("daily_reading_summary", None)
        summary.pop("hourly_access_summary", None)
    return {
        "id": run.id,
        "status": run.status,
        "cleanroom_id": run.cleanroom_id,
        "period_start": run.period_start,
        "period_end": run.period_end,
        "source_readings": run.source_readings,
        "prepared_readings": run.prepared_readings,
        "source_accesses": run.source_accesses,
        "prepared_accesses": run.prepared_accesses,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "summary": summary,
        **({"error_message": run.error_message} if include_details else {}),
    }


@router.post("/analitica/etl/ejecutar")
def run_etl(
    cleanroom_id: int | None = None,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    start, end = dashboard_period(start_at, end_at)
    return prepare_analytics_data(db, user, start, end, cleanroom_id)


@router.get("/analitica/etl/ejecuciones")
def etl_runs(
    limit: int = 20,
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    if not 1 <= limit <= 100:
        raise HTTPException(422, "limit debe estar entre 1 y 100")
    query = select(AnalyticsRun).order_by(desc(AnalyticsRun.started_at)).limit(limit)
    if "ADMINISTRADOR" not in {role.code for role in user.roles}:
        query = query.where(AnalyticsRun.initiated_by == user.id)
    runs = db.scalars(query).all()
    if "ADMINISTRADOR" not in {role.code for role in user.roles}:
        allowed_room_ids = {room.id for room in accessible_rooms(db, user)}
        visible_runs = []
        for run in runs:
            if run.initiated_by != user.id:
                continue
            run_room_ids = set(db.scalars(
                select(PreparedAnalyticsRecord.cleanroom_id)
                .where(PreparedAnalyticsRecord.run_id == run.id)
                .distinct()
            ).all())
            if run_room_ids.issubset(allowed_room_ids):
                visible_runs.append(run)
        runs = visible_runs
    return [serialize_etl_run(run) for run in runs]


@router.get("/analitica/etl/ejecuciones/{run_id}")
def etl_run_detail(
    run_id: int,
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    run = db.get(AnalyticsRun, run_id)
    if not run:
        raise HTTPException(404, "Ejecución no encontrada")
    if "ADMINISTRADOR" not in {role.code for role in user.roles}:
        if run.initiated_by != user.id:
            raise HTTPException(404, "Ejecución no encontrada")
        allowed_room_ids = {room.id for room in accessible_rooms(db, user)}
        run_room_ids = set(db.scalars(
            select(PreparedAnalyticsRecord.cleanroom_id)
            .where(PreparedAnalyticsRecord.run_id == run.id)
            .distinct()
        ).all())
        if not run_room_ids.issubset(allowed_room_ids):
            raise HTTPException(403, "Ya no tienes acceso a los cuartos de esta ejecución")
    return serialize_etl_run(run, include_details=True)


@router.post("/analitica/modelo/entrenar")
def train_model(
    run_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    if run_id is None:
        start, end = dashboard_period(None, None)
        prepared_run = prepare_analytics_data(db, user, start, end)
        run_id = prepared_run["run_id"]
    result = train_isolation_forest(db, user, run_id)
    return output(result)


@router.get("/analitica/modelo/metricas")
def model_metrics(
    cleanroom_id: int | None = None,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    is_admin = "ADMINISTRADOR" in {role.code for role in user.roles}
    if cleanroom_id is not None:
        if is_admin:
            if not db.get(Cleanroom, cleanroom_id):
                raise HTTPException(404, "Cuarto no encontrado")
        else:
            ensure_room_access(user, cleanroom_id)

    query = select(ModelResult).order_by(desc(ModelResult.trained_at))
    if cleanroom_id is not None:
        query = query.where(ModelResult.cleanroom_id == cleanroom_id)
    if start_at is not None or end_at is not None:
        start, end = dashboard_period(start_at, end_at)
        if cleanroom_id is None:
            query = query.where(ModelResult.cleanroom_id.is_(None))
        query = query.where(
            ModelResult.analytics_run_id.is_not(None),
            AnalyticsRun.id == ModelResult.analytics_run_id,
            AnalyticsRun.period_start < end,
            AnalyticsRun.period_end > start,
        )
    if not is_admin:
        query = query.where(ModelResult.analytics_run_id.is_not(None))
    results = db.scalars(query.limit(100)).all()

    if not is_admin:
        allowed_room_ids = {room.id for room in accessible_rooms(db, user)}
        visible_results = []
        for result in results:
            run_room_ids = set(db.scalars(
                select(PreparedAnalyticsRecord.cleanroom_id)
                .where(PreparedAnalyticsRecord.run_id == result.analytics_run_id)
                .distinct()
            ).all())
            if run_room_ids.issubset(allowed_room_ids):
                visible_results.append(result)
        results = visible_results
    return output(results[:50])


@router.get("/analitica/anomalias")
def anomalies(
    cleanroom_id: int | None = None, start_at: datetime | None = None, end_at: datetime | None = None,
    db: Session = Depends(get_db), user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    query = select(Alert).where(Alert.type == "OUT_OF_RANGE")
    room_ids = [room.id for room in accessible_rooms(db, user)] if "ADMINISTRADOR" not in {r.code for r in user.roles} else None
    if room_ids is not None:
        query = query.where(Alert.cleanroom_id.in_(room_ids)) if room_ids else query.where(False)
    if cleanroom_id is not None:
        if room_ids is not None and cleanroom_id not in room_ids:
            raise HTTPException(403, "Sin acceso al cuarto solicitado")
        query = query.where(Alert.cleanroom_id == cleanroom_id)
    start, end = dashboard_period(start_at, end_at)
    query = query.where(Alert.created_at >= start, Alert.created_at < end)
    query = query.order_by(desc(Alert.created_at)).limit(200)
    return output(db.scalars(query).all())


@router.get("/analitica/indicadores")
def indicators(
    cleanroom_id: int | None = None, start_at: datetime | None = None, end_at: datetime | None = None,
    db: Session = Depends(get_db), user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    room_ids = [room.id for room in accessible_rooms(db, user)] if "ADMINISTRADOR" not in {r.code for r in user.roles} else None
    if cleanroom_id is not None:
        if room_ids is not None and cleanroom_id not in room_ids:
            raise HTTPException(403, "Sin acceso al cuarto solicitado")
        room_ids = [cleanroom_id]
    start, end = dashboard_period(start_at, end_at)
    def scoped_count(model, *conditions):
        query = select(func.count(model.id)).where(*conditions)
        timestamp_col = SensorReading.recorded_at if model is SensorReading else AccessEvent.occurred_at if model is AccessEvent else Alert.created_at
        query = query.where(timestamp_col >= start, timestamp_col < end)
        if room_ids is not None:
            query = query.where(model.cleanroom_id.in_(room_ids)) if room_ids else query.where(False)
        return db.scalar(query) or 0
    return {
        "total_readings": scoped_count(SensorReading),
        "total_accesses": scoped_count(AccessEvent),
        "allowed_accesses": scoped_count(AccessEvent, AccessEvent.result == "ALLOWED"),
        "denied_accesses": scoped_count(AccessEvent, AccessEvent.result == "DENIED"),
        "active_alerts": scoped_count(Alert, Alert.status == "ACTIVE"),
    }


@router.get("/analitica/series")
def series(
    cleanroom_id: int | None = None,
    metric: str | None = None,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    query = select(SensorReading).order_by(SensorReading.recorded_at)
    if cleanroom_id is not None:
        room_ids = [room.id for room in accessible_rooms(db, user)] if "ADMINISTRADOR" not in {r.code for r in user.roles} else None
        if room_ids is not None and cleanroom_id not in room_ids:
            raise HTTPException(403, "Sin acceso al cuarto solicitado")
        query = query.where(SensorReading.cleanroom_id == cleanroom_id)
    else:
        room_ids = [room.id for room in accessible_rooms(db, user)] if "ADMINISTRADOR" not in {r.code for r in user.roles} else None
        if room_ids is not None:
            query = query.where(SensorReading.cleanroom_id.in_(room_ids)) if room_ids else query.where(False)
    if metric:
        query = query.where(SensorReading.metric == metric)
    start, end = dashboard_period(start_at, end_at)
    query = query.where(SensorReading.recorded_at >= start, SensorReading.recorded_at < end)
    return output(db.scalars(query.limit(1000)).all())


@router.get("/analitica/correlacion")
def correlation(
    cleanroom_id: int | None = None,
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    return compute_correlation(db, user, cleanroom_id)


@router.get("/analitica/patrones-acceso")
def access_patterns(
    cleanroom_id: int | None = None, start_at: datetime | None = None, end_at: datetime | None = None,
    db: Session = Depends(get_db), user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    start, end = dashboard_period(start_at, end_at)
    return compute_access_patterns(db, user, cleanroom_id, start, end)


@router.get("/dashboard/admin/summary")
def summary(
    cleanroom_id: int | None = None,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR")),
):
    start, end = dashboard_period(start_at, end_at)
    if cleanroom_id is not None and not db.get(Cleanroom, cleanroom_id):
        raise HTTPException(404, "Cuarto no encontrado")
    detail = get_supervisor_summary(db, user, cleanroom_id, start, end)
    room_ids = [room["id"] for room in detail["rooms"]]
    device_scope = Device.cleanroom_id.in_(room_ids) if room_ids else False
    reading_scope = SensorReading.cleanroom_id.in_(room_ids) if room_ids else False
    alert_scope = Alert.cleanroom_id.in_(room_ids) if room_ids else False

    def count(model, *conditions):
        return db.scalar(select(func.count(model.id)).where(*conditions)) or 0

    room_devices = db.scalars(select(Device).where(device_scope)).all()
    alert_rows = db.execute(
        select(Alert.created_at, Alert.severity).where(
            alert_scope, Alert.created_at >= start, Alert.created_at < end
        ).order_by(Alert.created_at.asc())
    ).all()
    alert_buckets: dict[str, dict[str, int]] = {}
    for occurred_at, severity in alert_rows:
        date_key = as_utc(occurred_at).strftime("%Y-%m-%d")
        bucket = alert_buckets.setdefault(date_key, {})
        key = (severity or "UNKNOWN").upper()
        bucket[key] = bucket.get(key, 0) + 1

    parameters = db.scalars(
        select(MonitoringParameter).where(
            MonitoringParameter.cleanroom_id.in_(room_ids) if room_ids else False,
            MonitoringParameter.enabled.is_(True),
        )
    ).all()
    limits = {(parameter.cleanroom_id, parameter.metric): parameter for parameter in parameters}
    reading_rows = db.scalars(
        select(SensorReading).where(
            reading_scope,
            SensorReading.recorded_at >= start,
            SensorReading.recorded_at < end,
        ).order_by(SensorReading.recorded_at.asc(), SensorReading.id.asc()).limit(20000)
    ).all()
    room_by_id = {room.id: room for room in db.scalars(select(Cleanroom).where(Cleanroom.id.in_(room_ids))).all()} if room_ids else {}
    environment_buckets: dict[tuple[str, int, str, str], dict[str, int | float | None]] = {}
    for reading in reading_rows:
        date_key = as_utc(reading.recorded_at).strftime("%Y-%m-%d")
        key = (date_key, reading.cleanroom_id, reading.metric, reading.unit)
        bucket = environment_buckets.setdefault(key, {"total": 0.0, "count": 0, "in_range": 0, "comparable": 0, "min_value": None, "max_value": None})
        bucket["total"] += float(reading.value)
        bucket["count"] += 1
        parameter = limits.get((reading.cleanroom_id, reading.metric))
        if parameter and parameter.unit == reading.unit:
            bucket["min_value"] = parameter.min_value
            bucket["max_value"] = parameter.max_value
            bucket["comparable"] += 1
            if parameter.min_value <= reading.value <= parameter.max_value:
                bucket["in_range"] += 1

    return {
        "cleanrooms": len(detail["rooms"]) if cleanroom_id is not None else db.scalar(select(func.count(Cleanroom.id))) or 0,
        "active_people": db.scalar(select(func.count(User.id)).where(User.status == "ACTIVE")) or 0,
        "devices": count(Device, device_scope),
        "readings": count(SensorReading, reading_scope, SensorReading.recorded_at >= start, SensorReading.recorded_at < end),
        "active_alerts": count(Alert, alert_scope, Alert.status == "ACTIVE"),
        "total_events": detail["total_events"],
        "entries": detail["entries"],
        "exits": detail["exits"],
        "denied": detail["denied"],
        "current_occupancy": detail["current_occupancy"],
        "rooms": detail["rooms"],
        "access_series": detail["access_series"],
        "alert_series": [
            {"date": date_key, "by_severity": counts}
            for date_key, counts in sorted(alert_buckets.items())
        ],
        "environment_series": [
            {
                "date": date_key,
                "cleanroom_id": room_id,
                "room_code": room_by_id[room_id].code if room_id in room_by_id else "",
                "metric": metric,
                "unit": unit,
                "average": round(values["total"] / values["count"], 2),
                "count": values["count"],
                "in_range_count": values["in_range"],
                "in_range_percent": round(100 * values["in_range"] / values["comparable"], 1) if values["comparable"] else None,
                "limits_sample_count": values["comparable"],
            }
            | {"min_value": values["min_value"], "max_value": values["max_value"]}
            for (date_key, room_id, metric, unit), values in sorted(environment_buckets.items())
        ],
        "device_status": [
            {"status": status, "count": sum(device.status == status for device in room_devices)}
            for status in sorted({device.status for device in room_devices})
        ],
        "period": {"start_at": start.isoformat(), "end_at": end.isoformat()},
    }


@router.get("/dashboard/supervisor/summary")
def supervisor_summary(
    cleanroom_id: int | None = None,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    start, end = dashboard_period(start_at, end_at)
    if cleanroom_id is not None and not db.get(Cleanroom, cleanroom_id):
        raise HTTPException(404, "Cuarto no encontrado")
    return get_supervisor_summary(db, user, cleanroom_id, start, end)
