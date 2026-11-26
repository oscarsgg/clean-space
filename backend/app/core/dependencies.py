import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_token, decode_token, hash_refresh
from app.db.database import get_db
from app.models import (
    AccessEvent,
    AccessLog,
    AccessPermission,
    AgentConversation,
    AgentDecisionLog,
    AgentMessage,
    AgentReport,
    Alert,
    Cleanroom,
    Command,
    Device,
    DoorPermission,
    ModelResult,
    MonitoringParameter,
    RefreshSession,
    RfidCard,
    Role,
    SensorReading,
    User,
)


settings = get_settings()
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def utcnow():
    return datetime.now(timezone.utc)


def output(obj):
    if isinstance(obj, list):
        return [output(item) for item in obj]
    if isinstance(
        obj,
        (
            User,
            Role,
            Cleanroom,
            Device,
            RfidCard,
            AccessPermission,
            AccessEvent,
            AccessLog,
            DoorPermission,
            SensorReading,
            MonitoringParameter,
            Alert,
            Command,
            ModelResult,
            AgentDecisionLog,
            AgentConversation,
            AgentMessage,
            AgentReport,
        ),
    ):
        return {column.name: getattr(obj, column.name) for column in obj.__table__.columns}
    return obj


def user_out(user):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "status": user.status,
        "roles": [role.code for role in user.roles],
    }


def current_user(
    request: Request,
    token: str | None = Depends(oauth2),
    db: Session = Depends(get_db),
):
    token = token or request.cookies.get("cleanspace_route_session")
    payload = decode_token(token, "access")
    user = db.get(User, int(payload["sub"])) if payload else None
    if not user or user.status != "ACTIVE":
        raise HTTPException(401, "Credenciales inválidas")
    return user


def require(*roles):
    def dependency(user=Depends(current_user)):
        if not any(role.code in roles for role in user.roles):
            raise HTTPException(403, "Permisos insuficientes")
        return user

    return dependency


def device_from_token(token: str, db: Session):
    payload = decode_token(token, "device")
    device = db.get(Device, int(payload["sub"])) if payload else None
    if not device or device.status != "ACTIVE":
        raise HTTPException(401, "Credenciales de dispositivo inválidas")
    return device


def issue_tokens(db: Session, user: User):
    access = create_token(
        str(user.id),
        "access",
        timedelta(minutes=settings.access_token_expire_minutes),
        [role.code for role in user.roles],
    )
    refresh = secrets.token_urlsafe(48)
    db.add(
        RefreshSession(
            user_id=user.id,
            token_hash=hash_refresh(refresh),
            expires_at=utcnow() + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    db.commit()
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
        "user": user_out(user),
    }


def record_alert(db: Session, room_id, device_id, reading_id, alert_type, severity, message):
    alert = Alert(
        cleanroom_id=room_id,
        device_id=device_id,
        reading_id=reading_id,
        type=alert_type,
        severity=severity,
        message=message,
    )
    db.add(alert)
    return alert


def ensure_room_access(user: User, room_id: int):
    role_codes = {role.code for role in user.roles}
    if "ADMINISTRADOR" in role_codes:
        return
    if room_id not in {room.id for room in user.assigned_cleanrooms}:
        raise HTTPException(403, "No tienes acceso a este cuarto")


def accessible_room_ids(user: User):
    if "ADMINISTRADOR" in {role.code for role in user.roles}:
        return None
    return [room.id for room in user.assigned_cleanrooms]


def require_admin_key(x_admin_key: str = Header(default="")):
    expected_key = settings.cleanspace_admin_key
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CLEANSPACE_ADMIN_KEY no está configurada",
        )
    if not hmac.compare_digest(x_admin_key, expected_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clave administrativa inválida")


def require_admin_or_jwt(
    x_admin_key: str = Header(default=""),
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
):
    """Allow an administrator session or a configured administrative API key."""
    if authorization.lower().startswith("bearer "):
        payload = decode_token(authorization.split(" ", 1)[1].strip(), "access")
        try:
            user = db.get(User, int(payload["sub"])) if payload else None
        except (KeyError, TypeError, ValueError):
            user = None
        if user and user.status == "ACTIVE" and any(role.code == "ADMINISTRADOR" for role in user.roles):
            return user

    expected_key = settings.cleanspace_admin_key
    if expected_key and x_admin_key and hmac.compare_digest(x_admin_key, expected_key):
        return True
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Se requiere sesión de administrador")


def require_device_or_jwt(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
):
    """Authenticate device JWTs or an active administrator/supervisor session."""
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Se requiere sesión o token de dispositivo")
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token, "access")
    if payload:
        try:
            user = db.get(User, int(payload["sub"]))
        except (KeyError, TypeError, ValueError):
            user = None
        if user and user.status == "ACTIVE" and any(
            role.code in {"ADMINISTRADOR", "SUPERVISOR"} for role in user.roles
        ):
            return ("user", user)
    payload = decode_token(token, "device")
    if payload:
        try:
            device = db.get(Device, int(payload["sub"]))
        except (KeyError, TypeError, ValueError):
            device = None
        if device and device.status == "ACTIVE":
            return ("device", device)
    raise HTTPException(status_code=401, detail="Credenciales inválidas")


def require_device_key(x_device_key: str = Header(default="")):
    expected_key = settings.cleanspace_device_key
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CLEANSPACE_DEVICE_KEY no está configurada",
        )
    if not hmac.compare_digest(x_device_key, expected_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clave de dispositivo inválida")
