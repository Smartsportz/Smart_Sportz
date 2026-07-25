from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import current_user
from app.core.rbac import ROLE_LABELS, ROLE_PERMISSIONS, ROLE_PROGRAMS, role_profile
from app.core.responses import ok
from app.core.security import create_token, verify_password
from app.db.database import row
from app.schemas import LoginRequest
from app.services.audit import log

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest):
    user = row("SELECT * FROM users WHERE email = ?", (payload.email,))
    if not user or not verify_password(payload.password, user["password_hash"]):
        log(payload.email, "login_failed", "auth", payload.email, "Invalid login attempt")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    access_token = create_token(user["id"], user["role"], expires_in=60 * 60)
    refresh_token = create_token(user["id"], user["role"], expires_in=60 * 60 * 24 * 7)
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


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return ok({**user, **role_profile(user["role"])})


@router.get("/roles")
def roles():
    return ok([role_profile(role) for role in ROLE_LABELS])


@router.post("/logout")
def logout(user: dict = Depends(current_user)):
    log(user["email"], "logout", "auth", user["id"], "User logged out")
    return ok(message="Logged out")
