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
    return DeliveryResult(False, "whatsapp", "SMS is disabled. WhatsApp verification is configured but inactive.")


def check_sms_otp(phone: str, code: str) -> DeliveryResult:
    return DeliveryResult(False, "whatsapp", "SMS verification checks are disabled.")


def send_sms_message(phone: str, message: str) -> DeliveryResult:
    return DeliveryResult(False, "whatsapp", "SMS sending is disabled. Use WhatsApp delivery when an API is configured.")


def send_whatsapp_message(phone: str, message: str) -> DeliveryResult:
    if not settings.whatsapp_delivery_enabled:
        return DeliveryResult(False, "whatsapp", "WhatsApp delivery is configured but inactive.")
    if settings.whatsapp_provider != "twilio":
        return DeliveryResult(False, "whatsapp", "No active WhatsApp API provider is configured.")
    auth = _twilio_auth_header()
    if not auth:
        return DeliveryResult(False, "twilio", "Twilio credentials are not configured")
    if not settings.twilio_from_number and not settings.twilio_messaging_service_sid:
        return DeliveryResult(False, "twilio", "WhatsApp requires TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID")
    to_number = settings.whatsapp_default_to or phone
    payload = {"To": f"whatsapp:{to_number}", "Body": message}
    if settings.twilio_messaging_service_sid:
        payload["MessagingServiceSid"] = settings.twilio_messaging_service_sid
    else:
        payload["From"] = settings.twilio_from_number if settings.twilio_from_number.startswith("whatsapp:") else f"whatsapp:{settings.twilio_from_number}"
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
        return DeliveryResult(True, "twilio", f"WhatsApp queued {payload.get('sid', '')}".strip())
    except Exception as exc:
        return DeliveryResult(False, "twilio", str(exc))


def send_email(to_email: str, subject: str, html: str, text: str | None = None) -> DeliveryResult:
    if settings.notification_delivery_mode == "whatsapp":
        return DeliveryResult(False, "whatsapp", "Email delivery is disabled. WhatsApp-only notifications are configured.")
    if settings.email_provider == "brevo":
        return send_brevo_email(to_email, subject, html, text)
    if not settings.resend_api_key:
        return DeliveryResult(False, "resend", "RESEND_API_KEY is not configured")
    delivery_to = settings.resend_test_to_email if settings.resend_force_test_recipient else to_email
    redirect_note = f" redirected to test inbox {delivery_to}" if delivery_to != to_email else ""
    if resend is not None:
        resend.api_key = settings.resend_api_key
        params: resend.Emails.SendParams = {
            "from": settings.resend_from_email,
            "to": [delivery_to],
            "subject": subject,
            "html": html,
        }
        if text:
            params["text"] = text
        try:
            email = resend.Emails.send(params)
            message = f"Email queued{redirect_note}"
            if isinstance(email, dict) and email.get("id"):
                message = f"{message} {email['id']}"
            return DeliveryResult(True, "resend", message.strip())
        except Exception as exc:
            return DeliveryResult(False, "resend", str(exc))
    body: dict[str, Any] = {
        "from": settings.resend_from_email,
        "to": [delivery_to],
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


def send_brevo_email(to_email: str, subject: str, html: str, text: str | None = None) -> DeliveryResult:
    if not settings.brevo_api_key:
        return DeliveryResult(False, "brevo", "BREVO_API_KEY is not configured")
    delivery_to = settings.brevo_test_to_email if settings.brevo_force_test_recipient else to_email
    redirect_note = f" redirected to test inbox {delivery_to}" if delivery_to != to_email else ""
    payload: dict[str, Any] = {
        "sender": {"name": settings.brevo_sender_name, "email": settings.brevo_sender_email},
        "to": [{"email": delivery_to}],
        "subject": subject,
        "htmlContent": html,
    }
    if text:
        payload["textContent"] = text
    request = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "api-key": settings.brevo_api_key,
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8") or "{}"
            response_payload = json.loads(body)
        message_id = response_payload.get("messageId", "")
        return DeliveryResult(True, "brevo", f"Email queued{redirect_note} {message_id}".strip())
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        return DeliveryResult(False, "brevo", f"HTTP {exc.code}: {error_body}")
    except Exception as exc:
        return DeliveryResult(False, "brevo", str(exc))


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
    if settings.notification_delivery_mode == "whatsapp":
        return DeliveryResult(False, "whatsapp", "Email OTP is disabled. WhatsApp-only verification is configured.")
    html = f"""
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0b1b33">
      <h2>Verify your Smart Sportz account</h2>
      <p>Your verification code is:</p>
      <p style="font-size:28px;font-weight:800;color:#007a4d;letter-spacing:4px">{code}</p>
      <p>This code expires soon. Do not share it with anyone.</p>
    </div>
    """
    return send_email(to_email, "Smart Sportz verification code", html, f"Your Smart Sportz verification code is {code}.")


def registration_completion_message(details: dict[str, Any]) -> str:
    payment_line = details.get("paymentDetails") or details.get("receiptNumber") or "Payment received"
    return (
        "Smart Sportz registration complete.\n"
        f"Tournament: {details.get('tournamentName')}\n"
        f"Team: {details.get('teamName')} ({details.get('teamCode')})\n"
        f"Unique ID: {details.get('confirmationCode')}\n"
        f"Payment: {payment_line}\n"
        f"QR: {details.get('qrPayload')}"
    )


def match_selection_message(details: dict[str, Any]) -> str:
    return (
        "Smart Sportz team selected for match.\n"
        f"Tournament: {details.get('tournamentName')}\n"
        f"Round: {details.get('round') or 'TBA'}\n"
        f"Teams: {details.get('teams') or 'TBA'}\n"
        f"Date: {details.get('startsAt') or 'TBA'}\n"
        f"Bracket details: {details.get('bracketDetails') or 'Published bracket'}"
    )


def match_reminder_message(details: dict[str, Any]) -> str:
    return (
        "Smart Sportz match reminder.\n"
        f"Tournament: {details.get('tournamentName')}\n"
        f"Round: {details.get('round') or 'TBA'}\n"
        f"Teams: {details.get('teams') or 'TBA'}\n"
        f"Match time: {details.get('startsAt') or 'TBA'} to {details.get('endsAt') or 'TBA'}\n"
        "Reminder: your match is scheduled in 2 days."
    )


def send_registration_payment_success(to_email: str, phone: str, details: dict[str, Any]) -> list[DeliveryResult]:
    whatsapp_message = registration_completion_message(details)
    result = send_whatsapp_message(phone or settings.twilio_default_to, whatsapp_message)
    if not result.ok:
        result.message = f"{result.message}; WhatsApp text fallback: {whatsapp_message}"
    return [result]


def send_match_selection_whatsapp(phone: str, details: dict[str, Any]) -> DeliveryResult:
    message = match_selection_message(details)
    result = send_whatsapp_message(phone or settings.whatsapp_default_to, message)
    if not result.ok:
        result.message = f"{result.message}; WhatsApp text fallback: {message}"
    return result


def send_match_reminder_whatsapp(phone: str, details: dict[str, Any]) -> DeliveryResult:
    message = match_reminder_message(details)
    result = send_whatsapp_message(phone or settings.whatsapp_default_to, message)
    if not result.ok:
        result.message = f"{result.message}; WhatsApp text fallback: {message}"
    return result
