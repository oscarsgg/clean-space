import json
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import require, require_device_or_jwt
from app.core.face_biometrics import VisionPipeline, decode_image_base64
from app.db.database import get_db
from app.models import (
    AccessEvent,
    AccessLog,
    Alert,
    Command,
    Device,
    DoorPermission,
    Employee,
    EmployeeBiometric,
    RfidTag,
)
from app.schemas.facial import (
    FacialBiometricRead,
    FacialEnrollRequest,
    FacialEnrollResponse,
    FacialVerifyRequest,
    FacialVerifyResponse,
)
from app.services.doors import cleanroom_for_door


router = APIRouter(prefix="/facial", tags=["Facial access"])
FULL_FACE_THRESHOLD = 0.42
PERIOCULAR_THRESHOLD = 0.48
AMBIGUOUS_SCORE_MARGIN = 0.04


def _decode_image(value: str):
    try:
        image = decode_image_base64(value)
    except Exception as error:
        raise HTTPException(status_code=400, detail="La imagen enviada no es válida") from error
    height, width = image.shape[:2]
    if width < 160 or height < 160 or width * height > 12_000_000:
        raise HTTPException(status_code=400, detail="La imagen debe medir entre 160 px y 12 MP")
    return image


def _record_result(
    session: Session,
    *,
    room_id: int,
    door_id: str,
    uid: str,
    person_name: str,
    employee_id: int | None,
    result: str,
    reason: str | None,
    now: datetime,
    alert: bool = False,
) -> AccessEvent:
    session.add(AccessLog(
        rfid_uid=uid,
        render_id=door_id,
        access_status="granted" if result == "ALLOWED" else "denied",
        created_at=date.today(),
    ))
    event = AccessEvent(
        employee_id=employee_id,
        cleanroom_id=room_id,
        door_id=door_id,
        rfid_uid=uid,
        person_name=person_name,
        event_type="FACIAL",
        direction="ENTRY",
        result=result,
        denial_reason=reason,
        occurred_at=now,
    )
    session.add(event)
    if alert:
        session.add(Alert(
            cleanroom_id=room_id,
            type="SECURITY",
            severity="WARNING",
            message=f"Acceso facial denegado en {door_id}: {reason or 'sin autorización'}",
            status="ACTIVE",
            created_at=now,
        ))
    session.commit()
    session.refresh(event)
    try:
        from app.services.realtime import publish_event
        payload = {
            "event_id": event.id,
            "cleanroom_id": room_id,
            "method": "FACIAL",
            "uid": uid,
            "rfid_uid": uid,
            "door_id": door_id,
            "person_name": person_name,
            "result": result,
            "direction": "ENTRY",
            "reason": reason,
            "denial_reason": reason,
            "occurred_at": now.isoformat(),
        }
        publish_event("access_event", payload)
        if alert:
            publish_event("alert_created", {"cleanroom_id": room_id, "message": payload["reason"]})
    except Exception:
        pass
    return event


@router.post("/enroll", response_model=FacialEnrollResponse, status_code=status.HTTP_201_CREATED)
def enroll_employee_face(
    request: FacialEnrollRequest,
    session: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR")),
):
    employee = session.get(Employee, request.employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    if not employee.isActive:
        raise HTTPException(status_code=409, detail="No se puede registrar biometría para personal inactivo")
    image = _decode_image(request.image_base64)
    faces, low_light_enhanced, _ = VisionPipeline.get_instance().detect_faces(image)
    if faces is None or len(faces) == 0:
        raise HTTPException(status_code=400, detail="No se detectó un rostro en la imagen")
    features = VisionPipeline.get_instance().extract_features(image, max(faces, key=lambda face: face[14]))
    biometric = EmployeeBiometric(
        employee_id=employee.id,
        sample_type=request.sample_type,
        full_face_vector=json.dumps(features["full_face_vector"]),
        periocular_vector=json.dumps(features["periocular_vector"]),
        is_masked=features["is_masked"],
        notes=request.notes or ("Registrado con mascarilla" if features["is_masked"] else None),
        is_active=True,
    )
    session.add(biometric)
    session.commit()
    session.refresh(biometric)
    return FacialEnrollResponse(
        success=True,
        biometric_id=biometric.id,
        employee_id=employee.id,
        sample_type=request.sample_type,
        is_masked=features["is_masked"],
        detection_confidence=features["confidence"],
        message=f"Perfil registrado para {employee.firstName} {employee.lastName}; mejora de luz: {low_light_enhanced}.",
    )


@router.post("/verify", response_model=FacialVerifyResponse)
def verify_facial_access(
    request: FacialVerifyRequest,
    session: Session = Depends(get_db),
    actor=Depends(require_device_or_jwt),
):
    room = cleanroom_for_door(session, request.door_id)
    if room is None:
        raise HTTPException(status_code=422, detail="La puerta no está asociada con un cuarto")
    actor_type, actor_record = actor
    if actor_type == "device" and actor_record.cleanroom_id != room.id:
        raise HTTPException(status_code=403, detail="El dispositivo no está asignado a esta sala")
    image = _decode_image(request.image_base64)
    pipeline = VisionPipeline.get_instance()
    faces, low_light_enhanced, _ = pipeline.detect_faces(image)
    now = datetime.now(timezone.utc)

    if faces is None or len(faces) == 0:
        event = _record_result(
            session, room_id=room.id, door_id=request.door_id, uid="NO_FACE_DETECTED",
            person_name="Sin rostro visible", employee_id=None, result="DENIED",
            reason="no_face_detected", now=now,
        )
        return FacialVerifyResponse(
            authorized=False, reason="no_face_detected", door_id=request.door_id,
            low_light_enhanced=low_light_enhanced, event_id=event.id,
        )

    features = pipeline.extract_features(image, max(faces, key=lambda face: face[14]))
    biometrics = session.scalars(
        select(EmployeeBiometric)
        .join(Employee, Employee.id == EmployeeBiometric.employee_id)
        .where(EmployeeBiometric.is_active.is_(True), Employee.isActive.is_(True))
    ).all()
    employee_scores: dict[int, tuple[float, str]] = {}
    for biometric in biometrics:
        if features["is_masked"]:
            vector = biometric.periocular_vector
            threshold = PERIOCULAR_THRESHOLD
            match_mode = "PERIOCULAR_EYES"
            candidate = features["periocular_vector"]
        elif biometric.full_face_vector:
            vector = biometric.full_face_vector
            threshold = FULL_FACE_THRESHOLD
            match_mode = "FULL_FACE"
            candidate = features["full_face_vector"]
        elif biometric.sample_type == "masked_cleanroom" and biometric.periocular_vector:
            vector = biometric.periocular_vector
            threshold = PERIOCULAR_THRESHOLD
            match_mode = "PERIOCULAR_EYES"
            candidate = features["periocular_vector"]
        else:
            continue
        try:
            score = pipeline.cosine_similarity(candidate, json.loads(vector))
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        current = employee_scores.get(biometric.employee_id)
        if current is None or score > current[0]:
            employee_scores[biometric.employee_id] = (score, match_mode)

    ranked = sorted(employee_scores.items(), key=lambda item: item[1][0], reverse=True)
    best = ranked[0] if ranked else None
    threshold = PERIOCULAR_THRESHOLD if best and best[1][1] == "PERIOCULAR_EYES" else FULL_FACE_THRESHOLD
    ambiguous = bool(
        best and len(ranked) > 1
        and ranked[1][1][0] >= threshold
        and best[1][0] - ranked[1][1][0] < AMBIGUOUS_SCORE_MARGIN
    )
    matched = session.get(Employee, best[0]) if best and best[1][0] >= threshold and not ambiguous else None
    best_score = best[1][0] if best else 0.0
    match_mode = best[1][1] if best else "NONE"

    if matched is None:
        reason = "ambiguous_face" if ambiguous else "unknown_face" if biometrics else "no_enrolled_profiles"
        event = _record_result(
            session, room_id=room.id, door_id=request.door_id, uid="UNKNOWN_FACE",
            person_name="Rostro no identificado", employee_id=None, result="DENIED",
            reason=reason, now=now, alert=reason != "no_enrolled_profiles",
        )
        return FacialVerifyResponse(
            authorized=False, reason=reason, confidence_score=round(best_score, 4),
            match_mode=match_mode, is_masked=features["is_masked"],
            low_light_enhanced=low_light_enhanced, door_id=request.door_id, event_id=event.id,
        )

    active_uids = select(RfidTag.uid).where(RfidTag.employee_id == matched.id, RfidTag.isActive.is_(True))
    permission = session.scalar(
        select(DoorPermission.id).where(
            DoorPermission.rfid_uid.in_(active_uids),
            DoorPermission.door_id == request.door_id,
            DoorPermission.is_active.is_(True),
        )
    )
    authorized = permission is not None
    reason = "allowed" if authorized else "no_permission_for_door"
    full_name = f"{matched.firstName} {matched.lastName}"
    event = _record_result(
        session, room_id=room.id, door_id=request.door_id,
        uid=f"FACE-{matched.id}", person_name=full_name, employee_id=matched.id,
        result="ALLOWED" if authorized else "DENIED", reason=None if authorized else reason,
        now=now, alert=not authorized,
    )

    command = None
    if authorized:
        device = session.scalar(
            select(Device).where(Device.cleanroom_id == room.id, Device.status == "ACTIVE").order_by(Device.id)
        )
        if device:
            command = Command(
                device_id=device.id,
                command="open_door",
                payload_json=json.dumps({"door_id": request.door_id, "duration_seconds": 5, "method": "facial"}),
            )
            session.add(command)
            session.commit()
            session.refresh(command)
            try:
                from app.services.realtime import publish_event
                publish_event("command_created", {
                    "id": command.id, "device_id": command.device_id,
                    "command": command.command, "status": command.status,
                    "cleanroom_id": room.id,
                })
            except Exception:
                pass

    return FacialVerifyResponse(
        authorized=authorized,
        reason=reason if not authorized else ("command_queued" if command else "authorized_device_unavailable"),
        employee_id=matched.id,
        employee_name=full_name,
        department=matched.department,
        confidence_score=round(best_score, 4),
        match_mode=match_mode,
        is_masked=features["is_masked"],
        low_light_enhanced=low_light_enhanced,
        door_id=request.door_id,
        door_unlocked=False,
        event_id=event.id,
        command_queued=command is not None,
        command_id=command.id if command else None,
    )


@router.get("/biometrics/{employee_id}", response_model=list[FacialBiometricRead])
def list_employee_biometrics(
    employee_id: int,
    session: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR")),
):
    if session.get(Employee, employee_id) is None:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return session.scalars(
        select(EmployeeBiometric).where(EmployeeBiometric.employee_id == employee_id)
    ).all()


@router.delete("/biometrics/{biometric_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_biometric_profile(
    biometric_id: int,
    session: Session = Depends(get_db),
    user=Depends(require("ADMINISTRADOR")),
):
    biometric = session.get(EmployeeBiometric, biometric_id)
    if biometric is None:
        raise HTTPException(status_code=404, detail="Perfil biométrico no encontrado")
    session.delete(biometric)
    session.commit()
