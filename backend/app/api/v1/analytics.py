from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.dependencies import output, require, utcnow
from app.db.database import get_db
from app.models import AccessEvent, Alert, Cleanroom, Device, ModelResult, SensorReading, User
from app.services.ecbd import (
    as_utc,
    accessible_rooms,
    compute_access_patterns,
    compute_correlation,
    get_supervisor_summary,
    train_isolation_forest,
)


router = APIRouter(tags=["Analytics"])


def dashboard_period(start_at: datetime | None, end_at: datetime | None) -> tuple[datetime, datetime]:
    end = as_utc(end_at) if end_at else utcnow()
    start = as_utc(start_at) if start_at else end - timedelta(days=7)
    if start >= end:
        raise HTTPException(422, "start_at debe ser anterior a end_at")
    if end - start > timedelta(days=366):
        raise HTTPException(422, "El periodo máximo permitido es de 366 días")
    return start, end


@router.post("/analitica/etl/ejecutar")
def run_etl(
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    return {
        "status": "completed",
        "processed_readings": db.scalar(select(func.count(SensorReading.id))) or 0,
        "processed_accesses": db.scalar(select(func.count(AccessEvent.id))) or 0,
        "executed_at": utcnow(),
    }


@router.post("/analitica/modelo/entrenar")
def train_model(
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    result = train_isolation_forest(db, user)
    return output(result)


@router.get("/analitica/modelo/metricas")
def model_metrics(db: Session = Depends(get_db), user=Depends(require("ADMINISTRADOR", "SUPERVISOR"))):
    query = select(ModelResult).order_by(desc(ModelResult.trained_at)).limit(50)
    room_ids = [room.id for room in accessible_rooms(db, user)] if "ADMINISTRADOR" not in {r.code for r in user.roles} else None
    if room_ids is not None:
        query = query.where(ModelResult.cleanroom_id.in_(room_ids)) if room_ids else query.where(False)
    return output(db.scalars(query).all())


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
