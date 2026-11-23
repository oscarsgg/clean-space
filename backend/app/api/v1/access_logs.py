from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

<<<<<<< HEAD
from app.core.dependencies import require
from app.core.rfid import normalize_rfid_uid
=======
from app.core.dependencies import require_admin_or_jwt
>>>>>>> 5d87d37 (Conexion con backend, nuevos endpoints y eliminacion de datos estaticos)
from app.db.database import get_db
from app.models import AccessLog, DoorPermission, Employee, RfidTag
from app.schemas.access_logs import AccessLogCreate, AccessLogRead


router = APIRouter(
    prefix="/access-logs",
    tags=["Access logs"],
    dependencies=[Depends(require_admin_or_jwt)],
)


@router.post("/", response_model=AccessLogRead, status_code=201)
def create_access_log(log_data: AccessLogCreate, session: Session = Depends(get_db), user=Depends(require("ADMINISTRADOR"))):
    if log_data.access_status not in {"granted", "denied", "offline_allowed"}:
        raise HTTPException(status_code=422, detail="access_status no es válido")
    uid = normalize_rfid_uid(log_data.rfid_uid)
    if log_data.access_status in {"granted", "offline_allowed"}:
        tag = session.get(RfidTag, uid)
        permission = session.scalar(
            select(DoorPermission).where(
                DoorPermission.rfid_uid == uid,
                DoorPermission.door_id == log_data.render_id,
            )
        )
        employee = session.get(Employee, tag.employee_id) if tag and tag.employee_id else None
        if not tag or not tag.isActive or not employee or not employee.isActive or not permission or not permission.is_active:
            raise HTTPException(status_code=422, detail="No se puede registrar acceso concedido sin tag, empleado y permiso activos")
    access_log = AccessLog(**{**log_data.model_dump(), "rfid_uid": uid})
    session.add(access_log)
    session.commit()
    session.refresh(access_log)
    return access_log


@router.get("/", response_model=list[AccessLogRead])
def get_access_logs(limit: int = 100, session: Session = Depends(get_db), user=Depends(require("ADMINISTRADOR", "SUPERVISOR"))):
    if not 1 <= limit <= 500:
        raise HTTPException(status_code=400, detail="limit debe estar entre 1 y 500")
    statement = select(AccessLog).order_by(desc(AccessLog.id)).limit(limit)
    return session.scalars(statement).all()
