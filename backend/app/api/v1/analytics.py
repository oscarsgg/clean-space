from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.dependencies import accessible_room_ids, output, require, utcnow
from app.db.database import get_db
from app.models import AccessEvent, Alert, Cleanroom, Device, ModelResult, SensorReading, User
from app.services.ecbd import (
    compute_access_patterns,
    compute_correlation,
    get_supervisor_summary,
    train_isolation_forest,
)


router = APIRouter(tags=["Analytics"])


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
    room_ids = accessible_room_ids(user)
    if room_ids is not None:
        query = query.where(ModelResult.cleanroom_id.in_(room_ids)) if room_ids else query.where(False)
    return output(db.scalars(query).all())


@router.get("/analitica/anomalias")
def anomalies(db: Session = Depends(get_db), user=Depends(require("ADMINISTRADOR", "SUPERVISOR"))):
    query = select(Alert).where(Alert.type == "OUT_OF_RANGE")
    room_ids = accessible_room_ids(user)
    if room_ids is not None:
        query = query.where(Alert.cleanroom_id.in_(room_ids)) if room_ids else query.where(False)
    query = query.order_by(desc(Alert.created_at)).limit(200)
    return output(db.scalars(query).all())


@router.get("/analitica/indicadores")
def indicators(db: Session = Depends(get_db), user=Depends(require("ADMINISTRADOR", "SUPERVISOR"))):
    room_ids = accessible_room_ids(user)
    def scoped_count(model, *conditions):
        query = select(func.count(model.id)).where(*conditions)
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
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    query = select(SensorReading).order_by(SensorReading.recorded_at)
    if cleanroom_id is not None:
        room_ids = accessible_room_ids(user)
        if room_ids is not None and cleanroom_id not in room_ids:
            query = query.where(False)
        query = query.where(SensorReading.cleanroom_id == cleanroom_id)
    else:
        room_ids = accessible_room_ids(user)
        if room_ids is not None:
            query = query.where(SensorReading.cleanroom_id.in_(room_ids)) if room_ids else query.where(False)
    if metric:
        query = query.where(SensorReading.metric == metric)
    return output(db.scalars(query.limit(1000)).all())


@router.get("/analitica/correlacion")
def correlation(
    cleanroom_id: int | None = None,
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    return compute_correlation(db, user, cleanroom_id)


@router.get("/analitica/patrones-acceso")
def access_patterns(db: Session = Depends(get_db), user=Depends(require("ADMINISTRADOR", "SUPERVISOR"))):
    return compute_access_patterns(db, user)


@router.get("/dashboard/admin/summary")
def summary(db: Session = Depends(get_db), user=Depends(require("ADMINISTRADOR"))):
    room_ids = accessible_room_ids(user)

    def scoped_count(model, *conditions):
        query = select(func.count(model.id)).where(*conditions)
        if room_ids is not None:
            query = query.where(model.cleanroom_id.in_(room_ids)) if room_ids else query.where(False)
        return db.scalar(query) or 0

    return {
        "cleanrooms": db.scalar(select(func.count(Cleanroom.id))) or 0,
        "active_people": db.scalar(select(func.count(User.id)).where(User.status == "ACTIVE")) or 0,
        "devices": scoped_count(Device),
        "readings": scoped_count(SensorReading),
        "active_alerts": scoped_count(Alert, Alert.status == "ACTIVE"),
    }


@router.get("/dashboard/supervisor/summary")
def supervisor_summary(db: Session = Depends(get_db), user=Depends(require("ADMINISTRADOR", "SUPERVISOR"))):
    return get_supervisor_summary(db, user)
