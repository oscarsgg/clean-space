from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import current_user, issue_tokens, settings, utcnow, user_out
from app.core.security import hash_refresh, verify_password
from app.db.database import get_db
from app.models import RefreshSession, User
from app.schemas.auth import LoginIn, RefreshIn


router = APIRouter(prefix="/auth", tags=["Authentication"])


def set_session_cookies(response: Response, access_token: str, refresh_token: str):
    common = {
        "httponly": True,
        "secure": settings.app_env.lower() not in {"development", "test"},
        "samesite": "lax",
        "path": "/",
        "domain": settings.cookie_domain or None,
    }
    response.set_cookie(
        "cleanspace_route_session",
        access_token,
        max_age=settings.access_token_expire_minutes * 60,
        **common,
    )
    response.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=settings.refresh_token_expire_days * 86400,
        **common,
    )


def clear_session_cookies(response: Response):
    response.delete_cookie("cleanspace_route_session", path="/", domain=settings.cookie_domain or None)
    response.delete_cookie("refresh_token", path="/", domain=settings.cookie_domain or None)


@router.post("/login")
async def login(request: Request, response: Response, db: Session = Depends(get_db)):
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        data = await request.json()
        email, password = data.get("email"), data.get("password")
    else:
        form = await request.form()
        email, password = form.get("username"), form.get("password")
    user = db.scalar(select(User).where(User.email == str(email).lower().strip())) if email else None
    if not user or not password or not verify_password(password, user.password_hash) or user.status != "ACTIVE":
        raise HTTPException(401, "Credenciales inválidas")
    result = issue_tokens(db, user)
    set_session_cookies(response, result["access_token"], result["refresh_token"])
    return result


@router.post("/refresh")
def refresh(
    request: Request,
    response: Response,
    data: RefreshIn | None = None,
    db: Session = Depends(get_db),
):
    token = (data.refresh_token if data else None) or request.cookies.get("refresh_token")
    session = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == hash_refresh(token or "")))
    if not session or session.revoked_at or session.expires_at < utcnow():
        raise HTTPException(401, "Refresh token inválido")
    session.revoked_at = utcnow()
    user = db.get(User, session.user_id)
    db.commit()
    result = issue_tokens(db, user)
    set_session_cookies(response, result["access_token"], result["refresh_token"])
    return result


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    data: RefreshIn | None = None,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    session = db.scalar(
        select(RefreshSession).where(
            RefreshSession.token_hash
            == hash_refresh(((data.refresh_token if data else None) or request.cookies.get("refresh_token") or "")),
            RefreshSession.user_id == user.id,
        )
    )
    if session:
        session.revoked_at = utcnow()
        db.commit()
    clear_session_cookies(response)


@router.get("/me")
def me(user=Depends(current_user)):
    return user_out(user)
