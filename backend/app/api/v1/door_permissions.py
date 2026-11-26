from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin_or_jwt
from app.core.rfid import normalize_rfid_uid
from app.db.database import get_db
from app.models import DoorPermission, Employee, RfidTag
from app.schemas.door_access import (
    DoorPermissionCreate,
    DoorPermissionRead,
    DoorPermissionUpdate,
)


router = APIRouter(
    prefix="/permissions",
    tags=["Access permissions"],
    dependencies=[Depends(require_admin_or_jwt)],
)


@router.post("/", response_model=DoorPermissionRead, status_code=status.HTTP_201_CREATED)
def create_permission(
    permission_data: DoorPermissionCreate,
    session: Session = Depends(get_db),
):
    uid = normalize_rfid_uid(permission_data.rfid_uid)
    if not uid:
        raise HTTPException(status_code=422, detail="UID RFID inválido")
    tag = session.get(RfidTag, uid)
    employee = None
    if permission_data.employee_id is not None:
        employee = session.get(Employee, permission_data.employee_id)
        if employee is None:
            raise HTTPException(status_code=404, detail="Empleado no encontrado")
        if tag is None:
            tag = RfidTag(uid=uid, employee_id=employee.id, isActive=True)
            session.add(tag)
            session.flush()
        else:
            tag.employee_id = employee.id
            tag.isActive = True
    elif tag is None:
        raise HTTPException(status_code=404, detail="Tag RFID no encontrado")
    elif tag.employee_id is not None:
        employee = session.get(Employee, tag.employee_id)
    existing = session.scalar(
        select(DoorPermission).where(
            DoorPermission.rfid_uid == uid,
            DoorPermission.door_id == permission_data.door_id,
        )
    )
    if existing is not None:
        existing.is_active = True
        session.commit()
        session.refresh(existing)
        permission = existing
    else:
        permission = DoorPermission(
            rfid_uid=uid,
            door_id=permission_data.door_id,
            is_active=permission_data.is_active,
        )
        session.add(permission)
        session.commit()
        session.refresh(permission)
    return DoorPermissionRead(
        id=permission.id, rfid_uid=permission.rfid_uid, door_id=permission.door_id,
        is_active=permission.is_active, created_at=permission.created_at,
        employee_id=employee.id if employee else None,
        employee_name=f"{employee.firstName} {employee.lastName}" if employee else None,
        department=employee.department if employee else None,
    )


@router.get("/", response_model=list[DoorPermissionRead])
def get_permissions(door_id: str | None = None, session: Session = Depends(get_db)):
    statement = (
        select(DoorPermission, Employee)
        .outerjoin(RfidTag, RfidTag.uid == DoorPermission.rfid_uid)
        .outerjoin(Employee, Employee.id == RfidTag.employee_id)
    )
    if door_id is not None:
        statement = statement.where(DoorPermission.door_id == door_id)
    return [
        DoorPermissionRead(
            id=permission.id, rfid_uid=permission.rfid_uid, door_id=permission.door_id,
            is_active=permission.is_active, created_at=permission.created_at,
            employee_id=employee.id if employee else None,
            employee_name=f"{employee.firstName} {employee.lastName}" if employee else None,
            department=employee.department if employee else None,
        )
        for permission, employee in session.execute(statement.order_by(desc(DoorPermission.id))).all()
    ]


@router.patch("/{permission_id}", response_model=DoorPermissionRead)
def update_permission(
    permission_id: int,
    permission_data: DoorPermissionUpdate,
    session: Session = Depends(get_db),
):
    permission = session.get(DoorPermission, permission_id)
    if permission is None:
        raise HTTPException(status_code=404, detail="Permiso no encontrado")
    if permission_data.is_active is not None:
        permission.is_active = permission_data.is_active
    session.commit()
    session.refresh(permission)
    return permission


@router.delete("/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_permission(permission_id: int, session: Session = Depends(get_db)):
    permission = session.get(DoorPermission, permission_id)
    if permission is None:
        raise HTTPException(status_code=404, detail="Permiso no encontrado")
    session.delete(permission)
    session.commit()
