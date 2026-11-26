from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import require_device_key
from app.core.rfid import normalize_rfid_uid
from app.db.database import get_db
from app.models import AccessEvent, AccessLog, Cleanroom, DoorPermission, Employee, RfidTag
from app.schemas.door_access import (
    DeviceAccessRequest,
    DeviceAccessResponse,
    DeviceSyncResponse,
    OfflineEventsRequest,
)
from app.services.doors import cleanroom_for_door

_last_scanned_card = {
    "uid": None, "door_id": None, "scanned_at": None,
    "authorized": None, "reason": None, "person_name": None,
}


def get_last_scanned_card():
    return dict(_last_scanned_card)


router = APIRouter(
    prefix="/device",
    tags=["Access device"],
    dependencies=[Depends(require_device_key)],
)


@router.get("/sync", response_model=DeviceSyncResponse)
def sync_permissions(door_id: str, session: Session = Depends(get_db)):
    statement = (
        select(DoorPermission.rfid_uid)
        .join(RfidTag, RfidTag.uid == DoorPermission.rfid_uid)
        .join(Employee, Employee.id == RfidTag.employee_id)
        .where(
            DoorPermission.door_id == door_id,
            DoorPermission.is_active.is_(True),
            RfidTag.isActive.is_(True),
            Employee.isActive.is_(True),
        )
    )
    return DeviceSyncResponse(door_id=door_id, allowed_uids=session.scalars(statement).all())


@router.post("/access", response_model=DeviceAccessResponse)
def check_access(access_request: DeviceAccessRequest, session: Session = Depends(get_db)):
    global _last_scanned_card
    uid = normalize_rfid_uid(access_request.uid)
    door_id = access_request.door_id
    tag = session.get(RfidTag, uid)
    reason = "unknown_tag"
    employee_name = None
    employee = None

    direction = access_request.direction
    employee = None
    if direction == "EXIT":
        reason = "egress"
    elif tag is not None:
        reason = "inactive_tag"
        if tag.isActive:
            reason = "unassigned_tag"
            if tag.employee_id is not None:
                employee = session.get(Employee, tag.employee_id)
                reason = "inactive_employee"
                if employee is not None and employee.isActive:
                    employee_name = f"{employee.firstName} {employee.lastName}"
                    permission = session.scalar(
                        select(DoorPermission).where(
                            DoorPermission.rfid_uid == uid,
                            DoorPermission.door_id == door_id,
                            DoorPermission.is_active.is_(True),
                        )
                    )
                    reason = "no_permission_for_door"
                    if permission is not None:
                        reason = "allowed"

    authorized = reason in {"allowed", "egress"}
    now = datetime.now(timezone.utc)
    _last_scanned_card = {
        "uid": uid, "door_id": door_id, "scanned_at": now.isoformat(),
        "authorized": authorized, "reason": reason, "person_name": employee_name,
    }
    session.add(
        AccessLog(
            rfid_uid=uid,
            render_id=door_id,
            access_status="granted" if authorized else "denied",
            created_at=date.today(),
        )
    )
    mapped_room = cleanroom_for_door(session, door_id)
    room = session.get(Cleanroom, access_request.cleanroom_id) if access_request.cleanroom_id else mapped_room
    if room is None:
        session.rollback()
        raise HTTPException(status_code=422, detail="La puerta no está asociada con un cuarto")
    if mapped_room is None or mapped_room.id != room.id:
        session.rollback()
        raise HTTPException(status_code=422, detail="La puerta no corresponde al cuarto indicado")
    if access_request.cleanroom_id and cleanroom_for_door(session, door_id) not in (None, room):
        session.rollback()
        raise HTTPException(status_code=422, detail="La puerta no corresponde al cuarto indicado")
    cleanroom_id = room.id
    event = AccessEvent(
        employee_id=employee.id if employee else None,
        cleanroom_id=cleanroom_id,
        rfid_uid=uid,
        door_id=door_id,
        person_name=employee_name or f"Tarjeta {uid}",
        event_type="RFID_IOT",
        direction=direction,
        result="ALLOWED" if authorized else "DENIED",
        denial_reason=None if authorized else reason,
        occurred_at=now,
    )
    session.add(event)
    session.commit()
    try:
        from app.services.realtime import publish_event
        publish_event("access_event", {
            "event_id": event.id, "cleanroom_id": cleanroom_id,
            "method": "RFID", "uid": uid, "rfid_uid": uid, "door_id": door_id,
            "result": "ALLOWED" if authorized else "DENIED",
            "direction": direction, "reason": reason,
            "denial_reason": None if authorized else reason,
            "person_name": employee_name or f"Tarjeta {uid}",
            "occurred_at": now.isoformat(),
        })
        publish_event("card_scanned", _last_scanned_card)
    except Exception:
        pass
    return DeviceAccessResponse(authorized=authorized, reason=reason, uid=uid, door_id=door_id)


@router.post("/events", status_code=202)
def upload_offline_events(events_request: OfflineEventsRequest, session: Session = Depends(get_db)):
    for event in events_request.events:
        uid = normalize_rfid_uid(event.uid)
        mapped_room = cleanroom_for_door(session, event.door_id)
        room = session.get(Cleanroom, event.cleanroom_id) if event.cleanroom_id else mapped_room
        if room is None or mapped_room is None or room.id != mapped_room.id:
            session.rollback()
            raise HTTPException(status_code=422, detail="El evento contiene una puerta sin cuarto asociado")
        session.add(
            AccessLog(
                rfid_uid=uid,
                render_id=event.door_id,
                access_status=event.access_status,
                created_at=event.created_at,
            )
        )
        tag = session.get(RfidTag, uid)
        employee = session.get(Employee, tag.employee_id) if tag and tag.employee_id else None
        result = "ALLOWED" if event.access_status == "offline_allowed" else "DENIED"
        occurred_at = datetime.combine(event.created_at, time.min, tzinfo=timezone.utc)
        session.add(AccessEvent(
            employee_id=employee.id if employee else None,
            cleanroom_id=room.id,
            rfid_uid=uid,
            door_id=event.door_id,
            person_name=f"{employee.firstName} {employee.lastName}" if employee else f"Tarjeta {uid}",
            event_type="RFID_OFFLINE",
            direction=event.direction,
            result=result,
            denial_reason=None if result == "ALLOWED" else "offline_denied",
            occurred_at=occurred_at,
        ))
    session.commit()
    try:
        from app.services.realtime import publish_event
        publish_event("access_event", {"batch_count": len(events_request.events), "source": "offline_sync"})
    except Exception:
        pass
    return {"accepted": len(events_request.events)}
