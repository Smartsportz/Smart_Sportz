from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from build_phase1_docx import p, rich_callout, style_xml, table
from build_phase2_docx import image_paragraph
from build_phase9_docx import (
    NS_A,
    NS_PIC,
    NS_R,
    NS_W,
    NS_WP,
    app_xml,
    content_types_xml,
    font_table_xml,
    numbering_xml,
    root_rels_xml,
    sect_pr,
    settings_xml,
)


OUT = Path("docs/Smart_Sportz_External_API_Integration_Blueprint.docx")
ASSET_DIR = Path("docs/assets")


def bullets(items: list[str]) -> list[str]:
    return [p(item, num_id=1) for item in items]


def document_xml() -> str:
    body: list[str] = []

    body.append(p("SMART SPORTZ - EXTERNAL API INTEGRATION BLUEPRINT", style="Title"))
    body.append(p("Provider List, Where Needed, Credentials, Backend Usage, Security Rules, and Implementation Priority", style="Subtitle"))
    body.append(p(""))
    body.append(table([
        ["Document", "External API Integration Blueprint"],
        ["Project", "Smart Sportz - Enterprise Sports Tournament Management Platform"],
        ["Purpose", "List every external API needed for production, where it is used in the frontend/backend, where to get credentials, and how backend should integrate it."],
        ["Frontend Reference", "Public website, tournament registration, payment receipt, live score hub, user portal, management portal, super admin, CMS, reports, logs, and settings pages."],
        ["Backend Rule", "Frontend must call Smart Sportz internal APIs only. External provider secrets must stay inside backend environment variables and secure secret storage."],
        ["Date", "July 23, 2026"],
        ["Version", "1.0"],
    ], [2400, 6960], header=False, fill="FFFFFF"))
    body.append(p(""))
    body.append(rich_callout("Core Integration Rule", [
        "Do not call payment, email, SMS, WhatsApp, push, media storage, bot protection verification, maps server APIs, or AI APIs directly from frontend pages with secret keys.",
        "The React frontend should call /api/v1 internal endpoints. The backend should validate permissions, call the external provider through an adapter service, save results to DB-1, mirror/backup where needed, and write DB-3 logs."
    ]))

    body.append(p("1. External API Ecosystem", style="Heading1"))
    body.append(p("Smart Sportz needs external providers for payment, communication, media storage, maps, bot protection, monitoring, and optional AI intelligence. These integrations should be wrapped inside backend services so providers can be changed later without rewriting frontend pages."))
    body.append(image_paragraph("rIdImage1", "External API Ecosystem Overview", "Smart Sportz external provider ecosystem connected through backend APIs", 1))

    body.append(p("2. Required External APIs", style="Heading1"))
    body.append(table([
        ["Priority", "External API", "Where Needed in Smart Sportz", "Credentials / Where to Get"],
        ["Must Have", "Razorpay Payment Gateway", "Registration payment, payment receipt page, admin payment operations, refunds, invoices, finance reports, webhook audit logs.", "Create Razorpay account, complete KYC, use Razorpay Dashboard to create Test/Live Key ID and Key Secret. Configure webhook URL and webhook secret."],
        ["Must Have", "Transactional Email Provider - Resend or SendGrid", "Login OTP, forgot password, registration confirmation, payment receipt, approval/rejection, match schedule updates, report export delivery, admin alerts.", "Resend: verify sending domain and create API key in Resend dashboard. SendGrid: verify sender/domain and create API key in SendGrid settings."],
        ["Must Have", "SMS Provider - Twilio, MSG91, or Fast2SMS", "OTP, registration status, urgent match reminders, payment alerts, venue change alerts, admin/security alerts.", "Twilio: Account SID, Auth Token or API Key, sender number/messaging service. MSG91/Fast2SMS: account auth key and approved sender/template details."],
        ["Must Have", "Media and Document Storage - Cloudinary or AWS S3", "Tournament banners, gallery, sponsor logos, team logos, player photos, verification documents, reports, receipts, invoices, certificates.", "Cloudinary: cloud name, API key, API secret. AWS S3: access key, secret key, region, bucket, IAM policy."],
        ["Must Have", "Bot Protection - Cloudflare Turnstile or Google reCAPTCHA", "Login, forgot password, OTP request, public registration, contact form, high-risk public forms.", "Turnstile: create widget to get sitekey and secret key. reCAPTCHA: create site key and secret key from Google Cloud/reCAPTCHA console."],
        ["Recommended", "WhatsApp Business Platform Cloud API", "Registration updates, payment success, approval/rejection, fixture reminders, match-day alerts, announcements, support messages.", "Meta Developer app, WhatsApp Business Account, phone number ID, access token, app secret, webhook verify token, approved message templates."],
        ["Recommended", "Firebase Cloud Messaging", "Browser/mobile push notifications for live match updates, tournament reminders, admin alerts, announcement delivery, user portal notifications.", "Firebase project, web app config, VAPID key for web push, service account credentials for backend send operations."],
        ["Recommended", "Google Maps Platform", "Venue location, tournament detail map, address autocomplete, geocoding, directions, venue administration.", "Google Cloud project, billing, Maps JavaScript API key, Places API, Geocoding API, restricted frontend and backend keys."],
        ["Recommended", "Monitoring and Error Tracking - Sentry or similar", "Production API errors, frontend errors, release health, stack traces, live score failures, webhook failures.", "Sentry project DSN, auth token for release upload, environment-specific project settings."],
        ["Optional", "OpenAI API", "AI report summaries, match insight generation, CMS suggestions, support assistant, admin analytics explanation.", "OpenAI Platform project API key and project settings. Keep key server-side only."],
        ["Optional", "Analytics - Google Analytics or Plausible", "Public website traffic, registration funnel, marketing pages, content performance, conversion tracking.", "Analytics property/site ID and frontend tracking key. Keep privacy settings aligned with policy."],
        ["Optional", "CDN/WAF - Cloudflare", "Domain DNS, CDN caching, WAF protection, SSL, Turnstile, security rules, public site performance.", "Cloudflare account, domain zone, DNS records, API token if deployment automation is needed."],
    ], [1200, 2100, 3850, 2210]))

    body.append(p("3. Provider Flow", style="Heading1"))
    body.append(p("All external provider communication should pass through backend adapter services. The adapter receives a normalized request from service logic, calls the provider, stores the response, handles retries, and logs the result."))
    body.append(image_paragraph("rIdImage2", "External Provider Flow", "Frontend calls backend, backend calls provider, provider webhook returns to backend, backend updates databases and notifications", 2))
    body.extend(bullets([
        "Frontend page submits a user action to Smart Sportz backend.",
        "Backend validates JWT, RBAC, scope, request body, rate limit, and idempotency key.",
        "Backend service writes pending state to DB-1 and calls provider adapter.",
        "Provider response is stored with safe metadata only; secrets are never returned to frontend.",
        "Provider webhook is signature-verified and processed idempotently.",
        "DB-1 is updated, DB-2 mirror/backup is triggered where required, DB-3 log/event record is written, and notifications are queued.",
    ]))

    body.append(p("4. Frontend Page to External API Need", style="Heading1"))
    body.append(table([
        ["Frontend Area", "External APIs Needed", "Backend Internal API Boundary"],
        ["Home / Tournaments / Sports / Teams", "Media storage, optional analytics, optional maps for venues.", "/api/v1/public/tournaments, /sports, /teams, /cms, /media"],
        ["Tournament Detail", "Media storage, Google Maps, analytics.", "/api/v1/public/tournaments/:slug, /venues/:id/map"],
        ["Registration Page", "Razorpay, media/document storage, Turnstile/reCAPTCHA, email, SMS, WhatsApp.", "/api/v1/registrations, /payments/orders, /files/upload-policy, /captcha/verify"],
        ["Payment Receipt Page", "Razorpay, email, PDF/file storage.", "/api/v1/payments/:id/status, /receipts/:id, /invoices/:id"],
        ["Login / Forgot Password / OTP", "Email, SMS, Turnstile/reCAPTCHA.", "/api/v1/auth/login, /forgot-password, /otp, /reset-password, /captcha/verify"],
        ["Live Hub / Live Match", "Socket.IO, Firebase push, optional notification providers.", "/api/v1/live/* and Socket.IO rooms"],
        ["User Portal", "Email, SMS, WhatsApp, push, file storage.", "/api/v1/user/profile, /registrations, /payments, /certificates"],
        ["Management Portal", "Push, WhatsApp/SMS announcements, file storage.", "/api/v1/management/* and Socket.IO control events"],
        ["Super Admin Payments", "Razorpay, email, PDF/file storage, monitoring.", "/api/v1/admin/payments, /refunds, /webhook-events"],
        ["Super Admin CMS", "Media storage, optional AI content suggestions, analytics.", "/api/v1/admin/cms, /media, /ai/content-suggestions"],
        ["Reports / Logs", "Email delivery, file storage, optional OpenAI summaries, monitoring.", "/api/v1/admin/reports, /exports, /logs"],
    ], [2500, 3300, 3560]))

    body.append(p("5. Payment API - Razorpay", style="Heading1"))
    body.append(table([
        ["Item", "Planning Detail"],
        ["Where used", "Registration payment, team entry fee, receipt, invoice, refund, admin finance dashboard, webhook audit."],
        ["Backend services", "PaymentService, RazorpayProvider, InvoiceService, ReceiptService, RefundService, PaymentWebhookService, AuditService."],
        ["Credentials", "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET."],
        ["Backend endpoints", "POST /api/v1/payments/orders, GET /api/v1/payments/:id/status, POST /api/v1/payments/webhooks/razorpay, POST /api/v1/admin/payments/:id/refund."],
        ["Security", "Verify webhook signature, check amount and currency, use idempotency, do not trust frontend payment success alone, restrict refund permission."],
        ["Database records", "Payment, PaymentEvent, Invoice, Receipt, Refund, AuditLog, NotificationJob."],
    ], [2300, 7060]))

    body.append(p("6. Communication APIs", style="Heading1"))
    body.append(table([
        ["Channel", "Where Needed", "Provider Details", "Backend Rules"],
        ["Email", "OTP, password reset, registration, payment receipt, approval/rejection, reports, admin alerts.", "Resend or SendGrid.", "Use templates, queue sending, record delivery status, never block payment flow on email delay."],
        ["SMS", "OTP, urgent alerts, payment status, venue changes.", "Twilio, MSG91, or Fast2SMS.", "Rate-limit OTP, use approved templates where required, store provider status."],
        ["WhatsApp", "Registration status, reminders, announcements, support.", "Meta WhatsApp Cloud API or Twilio WhatsApp.", "Use approved templates, opt-in rules, webhook delivery status, queue retries."],
        ["Push", "Live score, match reminders, user/admin alerts.", "Firebase Cloud Messaging.", "Store FCM tokens per device, support topic subscriptions, remove invalid tokens."],
        ["In-app", "Portal notifications.", "Internal DB/Redis, no external provider required.", "Store unread/read state, link to entity, broadcast through Socket.IO if active."],
    ], [1600, 2600, 2300, 2860]))

    body.append(p("7. Media, Maps, Bot Protection, and AI", style="Heading1"))
    body.append(table([
        ["Area", "Provider", "Where Needed", "Important Backend Logic"],
        ["Media and documents", "Cloudinary or AWS S3", "Banners, gallery, logos, player photos, documents, reports, invoices, certificates.", "Validate file type/size, private vs public buckets, signed URLs, virus scan option, metadata, audit downloads."],
        ["Maps", "Google Maps Platform", "Venue pages, tournament detail, admin venue setup.", "Use restricted keys, server-side geocoding if needed, never expose unrestricted backend key."],
        ["Bot protection", "Cloudflare Turnstile or reCAPTCHA", "Login, OTP, public registration, contact.", "Verify token server-side before expensive or risky operations."],
        ["AI optional", "OpenAI API", "Report summaries, match insights, support assistant, CMS suggestions.", "Admin-only features first, redact sensitive data, log usage, limit cost."],
        ["Monitoring", "Sentry or similar", "Frontend/backend production errors.", "Use environment-specific DSNs and do not send secrets or private documents in error payloads."],
    ], [1800, 2100, 2700, 2760]))

    body.append(p("8. Environment Variable Checklist", style="Heading1"))
    body.append(table([
        ["Provider", "Environment Variables"],
        ["Razorpay", "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET"],
        ["Email", "EMAIL_PROVIDER, RESEND_API_KEY or SENDGRID_API_KEY, EMAIL_FROM_ADDRESS, EMAIL_REPLY_TO"],
        ["SMS", "SMS_PROVIDER, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID or MSG91_AUTH_KEY / FAST2SMS_AUTH_KEY"],
        ["WhatsApp", "WHATSAPP_PROVIDER, META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID, META_WHATSAPP_BUSINESS_ACCOUNT_ID, META_WHATSAPP_WEBHOOK_VERIFY_TOKEN, META_WHATSAPP_APP_SECRET"],
        ["Firebase Push", "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FCM_WEB_VAPID_KEY"],
        ["Cloudinary", "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET"],
        ["AWS S3 Alternative", "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME"],
        ["Google Maps", "GOOGLE_MAPS_BROWSER_KEY, GOOGLE_MAPS_SERVER_KEY"],
        ["Bot Protection", "TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY or RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY"],
        ["OpenAI Optional", "OPENAI_API_KEY, OPENAI_PROJECT_ID"],
        ["Sentry Optional", "SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT"],
    ], [2600, 6760]))

    body.append(p("9. Security and Compliance Rules", style="Heading1"))
    body.extend(bullets([
        "Provider secrets must stay in backend environment variables or a production secret manager.",
        "Use separate development, staging, and production credentials for every provider.",
        "Restrict frontend public keys by domain where possible, especially Google Maps, Firebase web config, analytics, and Turnstile sitekey usage.",
        "Webhook endpoints must verify provider signatures and store raw event IDs for idempotency.",
        "All provider calls must use structured logs with correlation ID, but logs must not contain card data, OTP values, passwords, access tokens, or private documents.",
        "Use queues for slow provider calls such as email, WhatsApp, SMS, push, PDF generation, and report delivery.",
        "Record DB-3 logs for payment webhook, refund, notification failure, provider outage, suspicious login, OTP abuse, media upload rejection, and API key rotation.",
    ]))

    body.append(p("10. Implementation Priority", style="Heading1"))
    body.append(table([
        ["Phase", "Integrations to Configure", "Reason"],
        ["MVP 1", "Razorpay, Email, Media Storage, Turnstile/reCAPTCHA", "Needed for secure registration, payment, receipt, login, and document upload."],
        ["MVP 2", "SMS, WhatsApp, Firebase Cloud Messaging", "Needed for real tournament communications and live alerts."],
        ["MVP 3", "Google Maps, Sentry, Analytics", "Needed for venue UX, production monitoring, and conversion tracking."],
        ["Future", "OpenAI API, advanced CDN/WAF automation", "Useful after core workflows are stable."],
    ], [1800, 3500, 4060]))

    body.append(p("11. Official Reference Links", style="Heading1"))
    body.extend(bullets([
        "Razorpay API: https://razorpay.com/docs/api/",
        "Razorpay Webhooks: https://razorpay.com/docs/webhooks/",
        "Resend Email API: https://resend.com/docs/api-reference/introduction",
        "Twilio Programmable Messaging: https://www.twilio.com/docs/messaging/api",
        "Meta WhatsApp Business Platform: https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform",
        "Firebase Cloud Messaging: https://firebase.google.com/docs/cloud-messaging",
        "Cloudinary Upload API: https://cloudinary.com/documentation/image_upload_api_reference",
        "Google Maps API Key: https://developers.google.com/maps/documentation/javascript/get-api-key",
        "Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/get-started/",
        "OpenAI API Reference: https://platform.openai.com/docs/api-reference",
    ]))

    body.append(rich_callout("Final Recommendation", [
        "Start with Razorpay, Resend, Cloudinary or S3, and Turnstile because those unblock registration, payment, receipt, media upload, login safety, and production readiness.",
        "Add SMS, WhatsApp, and Firebase Cloud Messaging next so tournament participants and admins receive reliable real-time communication."
    ]))

    body.append(sect_pr())
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{NS_W}" xmlns:r="{NS_R}" xmlns:wp="{NS_WP}" xmlns:a="{NS_A}" xmlns:pic="{NS_PIC}">
  <w:body>
    {''.join(body)}
  </w:body>
</w:document>'''


def document_rels_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rIdFontTable" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
  <Relationship Id="rIdImage1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/api_ecosystem_overview.png"/>
  <Relationship Id="rIdImage2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/api_external_provider_flow.png"/>
</Relationships>'''


def core_xml() -> str:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Smart Sportz - External API Integration Blueprint</dc:title>
  <dc:subject>External API provider list, where needed, credentials, backend usage, security, and implementation priority.</dc:subject>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>'''


def build() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    assets = {
        "word/media/api_ecosystem_overview.png": ASSET_DIR / "api_ecosystem_overview.png",
        "word/media/api_external_provider_flow.png": ASSET_DIR / "api_external_provider_flow.png",
    }
    for source in assets.values():
        if not source.exists():
            raise FileNotFoundError(source)

    files = {
        "[Content_Types].xml": content_types_xml(),
        "_rels/.rels": root_rels_xml(),
        "docProps/core.xml": core_xml(),
        "docProps/app.xml": app_xml(),
        "word/document.xml": document_xml(),
        "word/_rels/document.xml.rels": document_rels_xml(),
        "word/styles.xml": style_xml(),
        "word/numbering.xml": numbering_xml(),
        "word/settings.xml": settings_xml(),
        "word/fontTable.xml": font_table_xml(),
    }
    with ZipFile(OUT, "w", ZIP_DEFLATED) as zf:
        for name, data in files.items():
            zf.writestr(name, data)
        for target, source in assets.items():
            zf.write(source, target)
    print(OUT.resolve())


if __name__ == "__main__":
    build()
