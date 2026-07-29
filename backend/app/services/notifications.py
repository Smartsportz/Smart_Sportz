from __future__ import annotations

import base64
import json
import random
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

from app.core.config import settings

try:
    import resend
except Exception:  # pragma: no cover - local env may install requirements later
    resend = None


@dataclass
class DeliveryResult:
    ok: bool
    provider: str
    message: str


def generate_otp(length: int = 4) -> str:
    start = 10 ** (length - 1)
    end = (10 ** length) - 1
    return str(random.randint(start, end))


def _twilio_auth_header() -> str | None:
    if settings.twilio_account_sid and settings.twilio_auth_token:
        username = settings.twilio_account_sid
        password = settings.twilio_auth_token
    else:
        username = settings.twilio_api_key_sid
        password = settings.twilio_api_key_secret
    if not username or not password:
        return None
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


def send_sms_otp(phone: str, code: str | None = None) -> DeliveryResult:
    if not settings.twilio_verify_service_sid:
        return DeliveryResult(False, "twilio", "TWILIO_VERIFY_SERVICE_SID is not configured")
    auth = _twilio_auth_header()
    if not auth:
        return DeliveryResult(False, "twilio", "Twilio credentials are not configured")
    to_number = settings.twilio_default_to or phone
    form = urllib.parse.urlencode({"To": to_number, "Channel": "sms"}).encode("utf-8")
    request = urllib.request.Request(
        f"https://verify.twilio.com/v2/Services/{settings.twilio_verify_service_sid}/Verifications",
        data=form,
        method="POST",
        headers={"Authorization": auth, "Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
        status = payload.get("status", "sent")
        return DeliveryResult(True, "twilio", f"SMS verification {status}")
    except Exception as exc:
        return DeliveryResult(False, "twilio", str(exc))


def check_sms_otp(phone: str, code: str) -> DeliveryResult:
    if not settings.twilio_verify_service_sid:
        return DeliveryResult(False, "twilio", "TWILIO_VERIFY_SERVICE_SID is not configured")
    auth = _twilio_auth_header()
    if not auth:
        return DeliveryResult(False, "twilio", "Twilio credentials are not configured")
    to_number = settings.twilio_default_to or phone
    form = urllib.parse.urlencode({"To": to_number, "Code": code}).encode("utf-8")
    request = urllib.request.Request(
        f"https://verify.twilio.com/v2/Services/{settings.twilio_verify_service_sid}/VerificationCheck",
        data=form,
        method="POST",
        headers={"Authorization": auth, "Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
        status = payload.get("status", "")
        return DeliveryResult(status == "approved", "twilio", f"SMS verification check {status}")
    except Exception as exc:
        return DeliveryResult(False, "twilio", str(exc))


def send_sms_message(phone: str, message: str) -> DeliveryResult:
    auth = _twilio_auth_header()
    if not auth:
        return DeliveryResult(False, "twilio", "Twilio credentials are not configured")
    if not settings.twilio_from_number and not settings.twilio_messaging_service_sid:
        return DeliveryResult(False, "twilio", "Payment SMS requires TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID")
    to_number = settings.twilio_default_to or phone
    payload = {"To": to_number, "Body": message}
    if settings.twilio_messaging_service_sid:
        payload["MessagingServiceSid"] = settings.twilio_messaging_service_sid
    else:
        payload["From"] = settings.twilio_from_number
    form = urllib.parse.urlencode(payload).encode("utf-8")
    request = urllib.request.Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json",
        data=form,
        method="POST",
        headers={"Authorization": auth, "Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return DeliveryResult(True, "twilio", f"SMS queued {payload.get('sid', '')}".strip())
    except Exception as exc:
        return DeliveryResult(False, "twilio", str(exc))


def send_email(to_email: str, subject: str, html: str, text: str | None = None) -> DeliveryResult:
    if not settings.resend_api_key:
        return DeliveryResult(False, "resend", "RESEND_API_KEY is not configured")
    if resend is not None:
        resend.api_key = settings.resend_api_key
        params: resend.Emails.SendParams = {
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
        if text:
            params["text"] = text
        try:
            email = resend.Emails.send(params)
            return DeliveryResult(True, "resend", f"Email queued {email.get('id', '')}".strip() if isinstance(email, dict) else "Email queued")
        except Exception as exc:
            return DeliveryResult(False, "resend", str(exc))
    body: dict[str, Any] = {
        "from": settings.resend_from_email,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    if text:
        body["text"] = text
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return DeliveryResult(True, "resend", f"Email queued {payload.get('id', '')}".strip())
    except Exception as exc:
        return DeliveryResult(False, "resend", str(exc))


def send_resend_sdk_test_email() -> dict[str, Any]:
    if resend is None:
        return {"ok": False, "provider": "resend", "message": "resend package is not installed"}
    if not settings.resend_api_key:
        return {"ok": False, "provider": "resend", "message": "RESEND_API_KEY is not configured"}
    resend.api_key = settings.resend_api_key
    params: resend.Emails.SendParams = {
        "from": "Acme <onboarding@resend.dev>",
        "to": ["delivered@resend.dev"],
        "subject": "hello world",
        "html": "<p>it works!</p>",
    }
    try:
        email = resend.Emails.send(params)
        return {"ok": True, "provider": "resend", "response": email}
    except Exception as exc:
        return {"ok": False, "provider": "resend", "message": str(exc)}


def send_email_otp(to_email: str, code: str) -> DeliveryResult:
    html = f"""
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0b1b33">
      <h2>Verify your Smart Sportz account</h2>
      <p>Your verification code is:</p>
      <p style="font-size:28px;font-weight:800;color:#007a4d;letter-spacing:4px">{code}</p>
      <p>This code expires soon. Do not share it with anyone.</p>
    </div>
    """
    return send_email(to_email, "Smart Sportz verification code", html, f"Your Smart Sportz verification code is {code}.")


def send_registration_payment_success(to_email: str, phone: str, details: dict[str, Any]) -> list[DeliveryResult]:
    members = details.get("members", [])
    member_items = "".join(f"<li>{member.get('role', 'Player')}: {member.get('name', '')}</li>" for member in members)
    html = f"""
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#0b1b33">
      <h2>Payment successful - Smart Sportz registration confirmed</h2>
      <p><b>Tournament:</b> {details.get('tournamentName')}</p>
      <p><b>Team:</b> {details.get('teamName')} ({details.get('teamCode')})</p>
      <p><b>Captain:</b> {details.get('captainName')}</p>
      <p><b>Receipt:</b> {details.get('receiptNumber')}</p>
      <p><b>Unique Code:</b> <span style="font-size:20px;font-weight:800;color:#007a4d">{details.get('confirmationCode')}</span></p>
      <p><b>QR Payload:</b></p>
      <pre style="white-space:pre-wrap;background:#f3faf6;border:1px solid #cde7dc;border-radius:8px;padding:12px">{details.get('qrPayload')}</pre>
      <h3>Registered Members</h3>
      <ul>{member_items}</ul>
    </div>
    """
    text = f"Payment successful. Team {details.get('teamName')} registration code: {details.get('confirmationCode')}. Receipt: {details.get('receiptNumber')}."
    results = [send_email(to_email, "Smart Sportz payment successful and registration code", html, text)]
    sms_message = f"Smart Sportz paid: {details.get('teamName')} code {details.get('confirmationCode')} receipt {details.get('receiptNumber')}"
    results.append(send_sms_message(phone or settings.twilio_default_to, sms_message))
    if not results[-1].ok:
        results[-1].message = f"{results[-1].message}; SMS text fallback: {sms_message}"
    return results
