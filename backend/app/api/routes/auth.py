from __future__ import annotations

import time

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.api.deps import current_user
from app.core.rbac import ROLE_LABELS, ROLE_PERMISSIONS, ROLE_PROGRAMS, role_profile
from app.core.responses import ok
from app.core.security import create_token, decode_token, verify_password
from app.db.database import row
from app.schemas import LoginRequest, RefreshTokenRequest
from app.services.audit import log
from app.services.runtime_state import runtime_state

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest):
    user = row("SELECT * FROM users WHERE email = ?", (payload.email,))
    if not user or not verify_password(payload.password, user["password_hash"]):
        log(payload.email, "login_failed", "auth", payload.email, "Invalid login attempt")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    access_token = create_token(user["id"], user["role"], expires_in=60 * 60)
    refresh_token = create_token(user["id"], user["role"], expires_in=60 * 60 * 24 * 7)
    access_payload = decode_token(access_token)
    refresh_payload = decode_token(refresh_token)
    if access_payload:
        runtime_state.mark_session(access_payload["jti"], {"userId": user["id"], "role": user["role"], "type": "access"}, 60 * 60)
    if refresh_payload:
        runtime_state.mark_session(refresh_payload["jti"], {"userId": user["id"], "role": user["role"], "type": "refresh"}, 60 * 60 * 24 * 7)
    log(user["email"], "login_success", "auth", user["id"], "User logged in")
    return ok({
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "roleLabel": ROLE_LABELS.get(user["role"], user["role"]),
            "permissions": ROLE_PERMISSIONS.get(user["role"], []),
            "programs": ROLE_PROGRAMS.get(user["role"], []),
            "homePath": role_profile(user["role"])["homePath"],
        },
    }, "Login successful")


@router.post("/refresh")
def refresh(payload: RefreshTokenRequest):
    refresh_payload = decode_token(payload.refresh_token)
    if not refresh_payload or not refresh_payload.get("jti"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    if runtime_state.is_token_revoked(refresh_payload["jti"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has been revoked")
    session = runtime_state.get_session(refresh_payload["jti"])
    if session and session.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh session")
    user = row("SELECT * FROM users WHERE id = ?", (refresh_payload["sub"],))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    access_token = create_token(user["id"], user["role"], expires_in=60 * 60)
    new_refresh_token = create_token(user["id"], user["role"], expires_in=60 * 60 * 24 * 7)
    access_payload = decode_token(access_token)
    new_refresh_payload = decode_token(new_refresh_token)
    if access_payload:
        runtime_state.mark_session(access_payload["jti"], {"userId": user["id"], "role": user["role"], "type": "access"}, 60 * 60)
    if new_refresh_payload:
        runtime_state.mark_session(new_refresh_payload["jti"], {"userId": user["id"], "role": user["role"], "type": "refresh"}, 60 * 60 * 24 * 7)
    runtime_state.revoke_token(refresh_payload["jti"], 1)
    log(user["email"], "token_refreshed", "auth", user["id"], "User session refreshed")
    return ok({
        "accessToken": access_token,
        "refreshToken": new_refresh_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "roleLabel": ROLE_LABELS.get(user["role"], user["role"]),
            "permissions": ROLE_PERMISSIONS.get(user["role"], []),
            "programs": ROLE_PROGRAMS.get(user["role"], []),
            "homePath": role_profile(user["role"])["homePath"],
        },
    }, "Session refreshed")


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return ok({**user, **role_profile(user["role"])})


@router.get("/roles")
def roles():
    return ok([role_profile(role) for role in ROLE_LABELS])


@router.post("/logout")
def logout(user: dict = Depends(current_user), authorization: str | None = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        payload = decode_token(authorization.split(" ", 1)[1])
        if payload and payload.get("jti"):
            ttl = max(1, int(payload["exp"]) - int(time.time()))
            runtime_state.revoke_token(payload["jti"], ttl)
    log(user["email"], "logout", "auth", user["id"], "User logged out")
    return ok(message="Logged out")
