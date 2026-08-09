from __future__ import annotations

import secrets
import time
import json
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import urlopen
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.api.deps import current_user
from app.core.rbac import ROLE_LABELS, ROLE_PERMISSIONS, ROLE_PROGRAMS, role_profile
from app.core.config import settings
from app.core.responses import ok
from app.core.security import create_token, decode_token, hash_password, verify_password
from app.db.database import execute, row
from app.schemas import ForgotPasswordResetRequest, ForgotPasswordStartRequest, GoogleLoginRequest, LoginOtpVerifyRequest, LoginRequest, RefreshTokenRequest, SignupStartRequest, SignupVerifyRequest
from app.services.audit import log
from app.services.notifications import generate_otp, send_whatsapp_message
from app.services.runtime_state import runtime_state

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_payload(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "roleLabel": ROLE_LABELS.get(user["role"], user["role"]),
        "permissions": ROLE_PERMISSIONS.get(user["role"], []),
        "programs": ROLE_PROGRAMS.get(user["role"], []),
        "homePath": role_profile(user["role"])["homePath"],
        "avatarUrl": user.get("avatar_url", ""),
        "googleLogin": bool(user.get("google_login", 0)),
    }


def _issue_session(user: dict, message: str):
    access_token = create_token(user["id"], user["role"], expires_in=60 * 60)
    refresh_token = create_token(user["id"], user["role"], expires_in=60 * 60 * 24 * 7)
    access_payload = decode_token(access_token)
    refresh_payload = decode_token(refresh_token)
    if access_payload:
        runtime_state.mark_session(access_payload["jti"], {"userId": user["id"], "role": user["role"], "type": "access"}, 60 * 60)
    if refresh_payload:
        runtime_state.mark_session(refresh_payload["jti"], {"userId": user["id"], "role": user["role"], "type": "refresh"}, 60 * 60 * 24 * 7)
    return ok({
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "user": _user_payload(user),
    }, message)


def _store_otp_challenge(purpose: str, payload: dict, channel: str, target: str, code: str, provider: str = "local") -> str:
    challenge_id = f"otp_{secrets.token_urlsafe(18)}"
    runtime_state.set_json(
        f"otp:{challenge_id}",
        {"purpose": purpose, "channel": channel, "target": target, "code": code, "provider": provider, "attempts": 0, **payload},
        10 * 60,
    )
    return challenge_id


def _read_otp_challenge(challenge_id: str) -> dict:
    challenge = runtime_state.get_json(f"otp:{challenge_id}")
    if not challenge:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP")
    return challenge


def _verify_otp(challenge_id: str, code: str) -> dict:
    challenge = _read_otp_challenge(challenge_id)
    attempts = int(challenge.get("attempts", 0)) + 1
    if attempts > 5:
        runtime_state.delete(f"otp:{challenge_id}")
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many OTP attempts")
    code_matches = str(challenge.get("code")) == code
    if not code_matches:
        challenge["attempts"] = attempts
        runtime_state.set_json(f"otp:{challenge_id}", challenge, 10 * 60)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP code")
    runtime_state.delete(f"otp:{challenge_id}")
    return challenge


def _challenge_response(challenge_id: str, channel: str, target: str, delivery_message: str):
    payload = {
        "otpRequired": True,
        "challengeId": challenge_id,
        "channel": channel,
        "target": target,
        "deliveryMessage": delivery_message,
    }
    return ok(payload, "OTP verification required")


def _deliver_otp(channel: str, target: str, code: str):
    if settings.otp_delivery_mode == "local":
        return "local", f"Local OTP: {code}"
    delivery = send_whatsapp_message(target, f"Your Smart Sportz WhatsApp verification code is {code}.")
    provider = "whatsapp" if delivery.ok else "local"
    return provider, delivery.message


def _deliver_privileged_otp(code: str):
    return "local", f"Local OTP: {code}"


def _generic_recovery_message(target: str) -> str:
    return f"If the account exists, a password reset OTP was sent to {target}."


def _verify_google_credential(credential: str) -> dict:
    if not settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google login is not configured")
    query = urlencode({"id_token": credential})
    try:
        with urlopen(f"https://oauth2.googleapis.com/tokeninfo?{query}", timeout=8) as response:
            profile = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google login verification failed") from exc
    if profile.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google login audience mismatch")
    if profile.get("email_verified") not in {True, "true", "True", "1", 1}:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google email is not verified")
    if not profile.get("email") or not profile.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google profile is incomplete")
    return profile


@router.post("/login")
def login(payload: LoginRequest):
    user = row("SELECT * FROM users WHERE email = ?", (payload.email,))
    if user and user.get("google_login"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="This account uses Google login. Please continue with Google.")
    if not user or not verify_password(payload.password, user["password_hash"]):
        log(payload.email, "login_failed", "auth", payload.email, "Invalid login attempt")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if user["role"] in {"super_admin", "management"}:
        code = generate_otp(4)
        target = "this login screen"
        provider, message = _deliver_privileged_otp(code)
        challenge_id = _store_otp_challenge("privileged_login", {"userId": user["id"]}, "whatsapp", target, code, provider)
        log(user["email"], "login_otp_displayed", "auth", user["id"], "Privileged OTP displayed locally")
        return _challenge_response(challenge_id, "whatsapp", target, message)
    log(user["email"], "login_success", "auth", user["id"], "User logged in")
    return _issue_session(user, "Login successful")


@router.post("/google")
def google_login(payload: GoogleLoginRequest):
    profile = _verify_google_credential(payload.credential)
    email = str(profile["email"]).lower()
    user = row("SELECT * FROM users WHERE email = ?", (email,))
    if user and user["role"] != "user":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Google login is available only for participant accounts")
    if user and not user.get("google_login"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email already uses password login. Please sign in with password.")
    if not user:
        user_id = f"user_{uuid4().hex[:12]}"
        execute(
            """
            INSERT INTO users(id, email, name, role, password_hash, phone, email_verified, phone_verified, google_login, google_sub, avatar_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                email,
                profile.get("name") or email.split("@")[0],
                "user",
                hash_password(secrets.token_urlsafe(32)),
                "",
                1,
                0,
                1,
                profile["sub"],
                profile.get("picture", ""),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        user = row("SELECT * FROM users WHERE id = ?", (user_id,))
        log(email, "google_signup", "auth", user_id, "Participant account created from Google profile")
    else:
        execute(
            "UPDATE users SET name = ?, google_sub = ?, avatar_url = ?, google_login = 1, email_verified = 1 WHERE id = ?",
            (profile.get("name") or user["name"], profile["sub"], profile.get("picture", ""), user["id"]),
        )
        user = row("SELECT * FROM users WHERE id = ?", (user["id"],))
        log(email, "google_login", "auth", user["id"], "Participant logged in with Google")
    return _issue_session(user, "Google login successful")


@router.post("/login/verify")
def verify_login_otp(payload: LoginOtpVerifyRequest):
    challenge = _verify_otp(payload.challenge_id, payload.code)
    if challenge.get("purpose") != "privileged_login":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP purpose")
    user = row("SELECT * FROM users WHERE id = ?", (challenge["userId"],))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    log(user["email"], "login_success", "auth", user["id"], "Privileged user logged in after OTP")
    return _issue_session(user, "Login verified")


@router.post("/signup/start")
def signup_start(payload: SignupStartRequest):
    existing = row("SELECT id FROM users WHERE email = ?", (payload.email,))
    if existing:
        raise HTTPException(status_code=409, detail="An account already exists for this email")
    code = generate_otp(4)
    target = payload.phone
    provider, message = _deliver_otp("whatsapp", target, code)
    challenge_id = _store_otp_challenge(
        "signup",
        {
            "name": payload.name,
            "email": str(payload.email),
            "phone": payload.phone,
            "passwordHash": hash_password(payload.password),
        },
        "whatsapp",
        target,
        code,
        provider,
    )
    log(str(payload.email), "signup_otp_sent", "auth", challenge_id, message)
    return _challenge_response(challenge_id, payload.channel, target, message)


@router.post("/forgot-password/start")
def forgot_password_start(payload: ForgotPasswordStartRequest):
    user = row("SELECT * FROM users WHERE email = ?", (payload.email,))
    target = user.get("phone") if user and user.get("phone") else str(payload.email)
    if user and user.get("google_login"):
        return _challenge_response("google_account", "whatsapp", target, "This account uses Google login. Password reset is not required.")
    if user:
        code = generate_otp(4)
        provider, message = _deliver_otp("whatsapp", target, code)
        challenge_id = _store_otp_challenge("password_reset", {"userId": user["id"]}, "whatsapp", target, code, provider)
        log(target, "password_reset_otp_sent", "auth", user["id"], message)
        return _challenge_response(challenge_id, "whatsapp", target, message if message.startswith("Local OTP:") else _generic_recovery_message(target))
    fake_challenge_id = _store_otp_challenge("password_reset_missing", {"email": str(payload.email)}, "whatsapp", target, generate_otp(4), "local")
    log(target, "password_reset_requested_missing", "auth", target, "Password reset requested for missing account")
    return _challenge_response(fake_challenge_id, "whatsapp", target, _generic_recovery_message(target))


@router.post("/forgot-password/reset")
def forgot_password_reset(payload: ForgotPasswordResetRequest):
    challenge = _verify_otp(payload.challenge_id, payload.code)
    if challenge.get("purpose") != "password_reset":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid password reset request")
    user = row("SELECT * FROM users WHERE id = ?", (challenge["userId"],))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.get("google_login"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Google-only accounts do not use password reset")
    execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(payload.password), user["id"]))
    log(user["email"], "password_reset", "auth", user["id"], "Participant password reset by OTP")
    return ok(message="Password changed successfully")


@router.post("/signup/verify")
def signup_verify(payload: SignupVerifyRequest):
    challenge = _verify_otp(payload.challenge_id, payload.code)
    if challenge.get("purpose") != "signup":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP purpose")
    existing = row("SELECT id FROM users WHERE email = ?", (challenge["email"],))
    if existing:
        raise HTTPException(status_code=409, detail="An account already exists for this email")
    user_id = f"user_{uuid4().hex[:12]}"
    email_verified = 0
    phone_verified = 1 if challenge["channel"] == "whatsapp" else 0
    execute(
        "INSERT INTO users(id, email, name, role, password_hash, phone, email_verified, phone_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            user_id,
            challenge["email"],
            challenge["name"],
            "user",
            challenge["passwordHash"],
            challenge["phone"],
            email_verified,
            phone_verified,
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    user = row("SELECT * FROM users WHERE id = ?", (user_id,))
    log(challenge["email"], "signup_verified", "auth", user_id, "Participant account created and verified")
    return _issue_session(user, "Account verified and created")


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
        "user": _user_payload(user),
    }, "Session refreshed")


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return ok({**user, **role_profile(user["role"])})


@router.get("/roles")
def roles():
    return ok([role_profile(role) for role in ROLE_LABELS])


@router.post("/test-email")
def test_email():
    raise HTTPException(status_code=status.HTTP_410_GONE, detail="Email delivery is disabled. WhatsApp-only notifications are configured.")


@router.post("/logout")
def logout(user: dict = Depends(current_user), authorization: str | None = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        payload = decode_token(authorization.split(" ", 1)[1])
        if payload and payload.get("jti"):
            ttl = max(1, int(payload["exp"]) - int(time.time()))
            runtime_state.revoke_token(payload["jti"], ttl)
    log(user["email"], "logout", "auth", user["id"], "User logged out")
    return ok(message="Logged out")
