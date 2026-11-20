from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import accessible_room_ids, output, require, user_out
from app.core.security import hash_password, hash_rfid
from app.db.database import get_db
from app.models import AccessPermission, RfidCard, Role, User
from app.schemas.people import PersonIn, PersonUpdate


router = APIRouter(tags=["People"])


@router.get("/roles")
def roles(db: Session = Depends(get_db), user=Depends(require("ADMINISTRADOR"))):
    return output(db.scalars(select(Role)).all())


@router.get("/personas")
def people(
    page: int = 1,
    size: int = Query(50, le=100),
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR", "SUPERVISOR")),
):
    if page < 1:
        raise HTTPException(400, "page debe ser mayor que cero")
    query = select(User).offset((page - 1) * size).limit(size)
    if status_filter:
        query = query.where(User.status == status_filter)
    if "ADMINISTRADOR" not in {role.code for role in user.roles}:
        room_ids = accessible_room_ids(user) or []
        query = query.where(User.id.in_(select(AccessPermission.user_id).where(AccessPermission.cleanroom_id.in_(room_ids)))) if room_ids else query.where(False)
    return [user_out(item) for item in db.scalars(query).all()]


@router.post("/personas", status_code=201)
def create_person(
    data: PersonIn,
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR")),
):
    if db.scalar(select(User).where(User.email == data.email.lower())):
        raise HTTPException(409, "El correo ya existe")
    roles = list(db.scalars(select(Role).where(Role.code.in_(data.role_codes))).all())
    if len(roles) != len(set(data.role_codes)):
        raise HTTPException(400, "Uno o más roles no existen")
    item = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        roles=roles,
    )
    try:
        db.add(item)
        if data.rfid_uid:
            uid_hash = hash_rfid(data.rfid_uid)
            if db.scalar(select(RfidCard).where(RfidCard.uid_hash == uid_hash)):
                raise HTTPException(409, "La tarjeta RFID ya está asignada")
            db.flush()
            db.add(RfidCard(user_id=item.id, uid_hash=uid_hash, label=data.card_label))
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(item)
    return user_out(item)


@router.put("/personas/{id}")
@router.patch("/personas/{id}")
def update_person(
    id: int,
    data: PersonUpdate,
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR")),
):
    item = db.get(User, id)
    if not item:
        raise HTTPException(404, "Persona no encontrada")
    if data.full_name is not None:
        item.full_name = data.full_name
    if data.status is not None:
        item.status = data.status
    if data.role_codes is not None:
        roles = list(db.scalars(select(Role).where(Role.code.in_(data.role_codes))).all())
        if len(roles) != len(set(data.role_codes)):
            raise HTTPException(400, "Uno o más roles no existen")
        item.roles = roles
    db.commit()
    db.refresh(item)
    return user_out(item)


@router.delete("/personas/{id}", status_code=204)
def delete_person(
    id: int,
    db: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR")),
):
    item = db.get(User, id)
    if not item:
        raise HTTPException(404, "Persona no encontrada")
    item.status = "INACTIVE"
    db.commit()
