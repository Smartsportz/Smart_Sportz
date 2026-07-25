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


OUT = Path("docs/Smart_Sportz_API_Master_Internal_External_API_Specification.docx")
ASSET_DIR = Path("docs/assets")


def bullets(items: list[str]) -> list[str]:
    return [p(item, num_id=1) for item in items]


def document_xml() -> str:
    body: list[str] = []

    body.append(p("SMART SPORTZ - API MASTER SPECIFICATION", style="Title"))
    body.append(p("", style="Subtitle"))
    body.append(p("Internal API, External API Provider, Page Workflow, Webhook, Socket, and Credential Blueprint", style="Subtitle"))
    body.append(p("Consolidated from Smart Sportz phase documents and current official provider documentation", style="Heading2"))
    body.append(p(""))
    body.append(table([
        ["Document", "API Master Internal and External API Specification"],
        ["Project", "Smart Sportz"],
        ["Scope", "External APIs needed, where to get credentials, internal REST APIs, Socket.IO events, page-to-endpoint mapping, webhooks, API security, response format, and implementation rules"],
        ["Backend Stack", "Production target: Node.js, Express, Socket.IO, PostgreSQL, Prisma, Redis, service layer, repository pattern, middleware, validation, caching, audit logs. Current local implementation: Python FastAPI with SQLite/local storage until external providers are connected."],
        ["Frontend Stack", "React, Vite, TypeScript, Tailwind, Redux, React Query, Framer Motion, reusable UI components"],
        ["Style", "Same compact black phase-document style: Times New Roman, black headings, single spacing, fixed tables, page border, compact margins"],
        ["Date", "July 24, 2026"],
        ["Version", "1.1"],
    ], [2400, 6960], header=False, fill="FFFFFF"))
    body.append(p(""))
    body.append(rich_callout("API Master Intent", [
        "This document defines what external APIs Smart Sportz needs, where the developer gets each credential, and how those providers connect to the Smart Sportz backend.",
        "It also defines internal APIs by frontend page and module so the frontend, backend, database, notification, payment, and live score systems can be developed with one consistent contract."
    ]))

    body.append(p("1. API Architecture Objective", style="Heading1"))
    body.append(p("Smart Sportz should expose one consistent internal API surface for the frontend and management portals while hiding all third-party provider secrets behind the backend. External provider integrations must be wrapped by internal services so providers can be replaced later without changing frontend pages."))
    body.extend(bullets([
        "Use /api/v1 as the main REST namespace for all internal HTTP APIs.",
        "Use Socket.IO namespaces or rooms for live score, live dashboard, announcements, and real-time tournament updates.",
        "Keep payment, SMS, WhatsApp, email, push, media, maps, and AI provider credentials only in backend environment variables.",
        "Log every sensitive API action in DB-3 and mirror transactional DB-1 state into DB-2 according to the database master architecture.",
        "Use idempotency keys for payment, webhook, notification, upload, export, and retry-sensitive APIs.",
    ]))

    body.append(p("2. API Ecosystem Overview", style="Heading1"))
    body.append(image_paragraph("rIdImage1", "Smart Sportz API Ecosystem Overview", "Frontend pages, internal APIs, backend modules, databases, Redis, Socket.IO, and external providers", 1))
    body.append(table([
        ["Layer", "Responsibility"],
        ["Frontend Pages", "Public website, authentication, registration, payment, super admin, management user, live score, reports, and CMS pages call internal APIs only."],
        ["API Gateway", "Express routes apply JWT authentication, RBAC, validation, rate limiting, request IDs, audit context, and error formatting."],
        ["Service Layer", "Business logic for tournaments, registrations, teams, players, fixtures, live scores, payments, notifications, CMS, reports, and logs."],
        ["Data Layer", "DB-1 editable primary data, DB-2 immutable mirror backup, DB-3 logs/events, Redis sessions/cache/live state."],
        ["External Providers", "Razorpay, SMS provider, Meta WhatsApp Cloud API, email provider, Firebase Cloud Messaging, media storage, maps, CAPTCHA, and optional OpenAI APIs."],
    ], [2300, 7060]))

    body.append(p("3. External APIs Needed and Where to Get Them", style="Heading1"))
    body.append(p("These external APIs are recommended for production Smart Sportz. The backend should integrate them through provider adapter services, not directly from frontend pages."))
    body.append(table([
        ["Need", "Recommended Provider and Where to Get"],
        ["Payments, refunds, invoices", "Razorpay Payment Gateway. Create a Razorpay account, complete business/KYC requirements, then generate Test and Live API keys from the Razorpay Dashboard. Docs: https://razorpay.com/docs/api/ and auth/key guide: https://razorpay.com/docs/api/authentication/"],
        ["Payment status callbacks", "Razorpay Webhooks. Configure webhook URL in Razorpay Dashboard and store webhook secret in backend env. Docs: https://razorpay.com/docs/webhooks/"],
        ["SMS OTP and alerts", "Primary option: Twilio Programmable Messaging for global SMS, from Twilio Console/API keys. Docs: https://www.twilio.com/docs/messaging/api. India-focused options: MSG91 docs https://docs.msg91.com/ or Fast2SMS Dev API https://www.fast2sms.com/help/send-sms-dev-api/"],
        ["WhatsApp notifications", "Meta WhatsApp Business Platform Cloud API. Create Meta developer app, connect business, add phone number, generate access token, and configure webhook. Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started"],
        ["Transactional email", "Resend or Twilio SendGrid. Resend API keys are managed in the Resend API Key Dashboard: https://resend.com/docs/dashboard/api-keys/introduction. SendGrid API keys are under Settings -> API Keys: https://www.twilio.com/docs/sendgrid/ui/account-and-settings/api-keys"],
        ["Push notifications", "Firebase Cloud Messaging. Create Firebase project, configure web/mobile app, get service account credentials, and send FCM messages from backend. Docs: https://firebase.google.com/docs/cloud-messaging"],
        ["Image, gallery, document uploads", "Cloudinary Upload API for managed media or AWS S3 for object storage. Cloudinary docs: https://cloudinary.com/documentation/image_upload_api_reference. S3 API docs: https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html"],
        ["Maps and venue location", "Google Maps Platform. Create Google Cloud project, enable Maps JavaScript/Places/Geocoding APIs, create and restrict API key. Docs: https://developers.google.com/maps/documentation/javascript/get-api-key"],
        ["Bot protection", "Cloudflare Turnstile or Google reCAPTCHA. Turnstile widget gives sitekey/secret key from Cloudflare dashboard: https://developers.cloudflare.com/turnstile/get-started/. reCAPTCHA keys: https://docs.cloud.google.com/recaptcha/docs/create-key-website"],
        ["Optional AI intelligence", "OpenAI API for assistant features such as report summaries, match insights, content suggestions, and support assistant. Get project API keys from OpenAI Platform. API reference: https://platform.openai.com/docs/api-reference"],
    ], [2600, 6760]))

    body.append(p("4. External Provider Flow", style="Heading1"))
    body.append(image_paragraph("rIdImage2", "External API Provider Flow", "External provider integration and webhook verification flow", 2))
    body.extend(bullets([
        "Frontend never calls payment, SMS, WhatsApp, email, push, storage, maps secret, or AI provider secrets directly.",
        "Backend validates the user action, creates the provider request, stores a pending record in DB-1, and logs the attempt in DB-3.",
        "Provider webhook callbacks must be signature-verified before updating DB-1 state.",
        "Every webhook handler must be idempotent so repeated provider callbacks do not duplicate receipts, notifications, registrations, refunds, or logs.",
        "Provider failures should enter retry queues with clear status and alerting, not silently fail.",
    ]))

    body.append(p("5. External API Environment Variables", style="Heading1"))
    body.append(table([
        ["Provider", "Required Backend Environment Variables"],
        ["Razorpay", "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET"],
        ["SMS", "SMS_PROVIDER, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID or MSG91_AUTH_KEY / FAST2SMS_AUTH_KEY"],
        ["WhatsApp", "WHATSAPP_PROVIDER, META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID, META_WHATSAPP_BUSINESS_ACCOUNT_ID, META_WHATSAPP_WEBHOOK_VERIFY_TOKEN, META_WHATSAPP_APP_SECRET"],
        ["Email", "EMAIL_PROVIDER, RESEND_API_KEY or SENDGRID_API_KEY, EMAIL_FROM_ADDRESS, EMAIL_REPLY_TO"],
        ["Push", "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FCM_WEB_VAPID_KEY"],
        ["Media Storage", "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET or AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME"],
        ["Maps", "GOOGLE_MAPS_API_KEY for browser-restricted frontend map loading and server-restricted geocoding key if needed"],
        ["Bot Protection", "TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY or RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY"],
        ["OpenAI Optional", "OPENAI_API_KEY, OPENAI_PROJECT_ID if AI features are enabled"],
    ], [2500, 6860]))

    body.append(p("6. Internal API Standards", style="Heading1"))
    body.append(p("All internal APIs should use a predictable REST contract, shared error shape, audit metadata, and consistent pagination/filtering. This keeps React Query integration clean and makes Super Admin and Management pages reusable."))
    body.append(table([
        ["Standard", "Rule"],
        ["Base URL", "/api/v1"],
        ["Authentication", "JWT access token in Authorization header, refresh token rotation, Redis-backed session/revocation data."],
        ["Authorization", "RBAC middleware checks role, permission, tournament scope, organization scope, and action type."],
        ["Validation", "Validate body, params, query, files, and provider webhook signatures before service execution."],
        ["Response Shape", "{ success, data, meta, error, requestId, timestamp } with stable error codes."],
        ["Pagination", "Use page/limit for normal tables and cursor pagination for heavy logs, match events, payments, and reports."],
        ["Filtering", "Support status, sport, tournament, date range, search, role, permission, payment status, approval status, and venue filters."],
        ["Audit", "Write DB-3 audit records for login, mutation, approval, payment, score change, export, settings, webhook, and security events."],
        ["Caching", "Use Redis for public pages, lookup lists, sessions, dashboards, live state, and rate limits."],
    ], [2200, 7160]))

    body.append(p("7. Internal API Module Map", style="Heading1"))
    body.append(image_paragraph("rIdImage3", "Internal API Module Map", "Smart Sportz internal REST API module map", 3))
    body.append(table([
        ["Module", "Core Endpoints"],
        ["Auth", "POST /auth/login, POST /auth/otp/send, POST /auth/otp/verify, POST /auth/refresh, POST /auth/logout, POST /auth/forgot-password, POST /auth/reset-password, GET /auth/me"],
        ["Users and RBAC", "GET/POST /admin/users, GET/PATCH/DELETE /admin/users/:id, GET/POST /admin/roles, GET/POST /admin/permissions, PATCH /admin/users/:id/status"],
        ["Tournament", "GET/POST /tournaments, GET/PATCH/DELETE /tournaments/:id, PATCH /management/tournaments/:slug/team-size, POST /tournaments/:id/publish, POST /tournaments/:id/fixtures/generate, GET /public/tournaments/:slug/bracket"],
        ["Registration", "POST /registrations/team or POST /registrations, POST /registrations/player, POST /registrations/:id/documents, PATCH /management/registrations/:id/approve, PATCH /management/registrations/:id/reject, GET /registrations/status/:code"],
        ["Teams and Players", "GET/POST /teams, GET/PATCH /teams/:id, GET/POST /players, GET/PATCH /players/:id, POST /teams/:id/roster"],
        ["Payments", "POST /payments/orders, POST /payments/verify, POST /payments/webhook/razorpay, POST /payments/:id/refund, GET /payments/:id/receipt, GET /payments/:id/invoice"],
        ["Live Score", "GET /matches/live, POST /matches/:id/events, PATCH /matches/:id/score, PATCH /matches/:id/status, GET /matches/:id/timeline, GET /matches/:id/statistics"],
        ["CMS", "GET/POST /cms/pages, GET/POST /cms/sponsors, GET/POST /cms/gallery, GET/POST /cms/blogs, GET/POST /cms/faqs, POST /cms/publish"],
        ["Bracket and Rounds", "GET /public/tournaments/:slug/bracket, GET /management/brackets/:tournamentSlug, POST /management/brackets/:tournamentSlug/save, POST /management/brackets/:tournamentSlug/advance-winner, POST /management/brackets/:tournamentSlug/notify"],
        ["Notifications", "POST /notifications/send, POST /management/brackets/:tournamentSlug/notify, GET/POST /notifications/templates, GET /notifications/logs, POST /notifications/test"],
        ["Reports and Logs", "GET /reports/dashboard, GET /reports/tournaments, GET /reports/payments, GET /reports/export, GET /logs/audit, GET /logs/login, GET /logs/webhooks"],
    ], [2200, 7160]))

    body.append(p("8. Frontend Pages and Internal API Details", style="Heading1"))
    body.append(image_paragraph("rIdImage5", "Frontend Page to Internal Endpoint Map", "Frontend pages mapped to Smart Sportz internal API namespaces", 5))
    body.append(table([
        ["Page Area", "Internal APIs Needed"],
        ["Landing Home", "GET /public/home, GET /public/tournaments/live, GET /public/sponsors, GET /public/stats, GET /public/gallery, GET /public/testimonials"],
        ["Tournament Listing", "GET /public/tournaments?status=&sport=&search=&page=, GET /public/sports, GET /public/sports/:slug, GET /public/venues"],
        ["Tournament Detail", "GET /public/tournaments/:slug, GET /public/tournaments/:slug/bracket, GET /public/tournaments/:id/fixtures, GET /public/tournaments/:id/standings, GET /public/tournaments/:id/gallery"],
        ["Sport Tournament Page", "GET /public/sports/:slug returns only selected sport tournaments grouped as upcoming, live, and existing/completed. Do not mix all-sport tournaments on selected sport pages."],
        ["Registration Form", "GET /public/tournaments/:slug for team_size, POST /registrations or /registrations/team with members[] exactly matching tournament team_size, POST /registrations/:id/documents, GET /registrations/status/:code"],
        ["Payment Page", "POST /payments/orders, POST /payments/verify, GET /payments/:id/receipt, GET /payments/:id/invoice"],
        ["Auth Pages", "POST /auth/login, POST /auth/otp/send, POST /auth/otp/verify, POST /auth/forgot-password, POST /auth/reset-password, POST /auth/refresh, GET /auth/me"],
        ["Super Admin Dashboard", "GET /admin/dashboard, GET /reports/dashboard, GET /logs/audit, GET /logs/login, GET /reports/payments"],
        ["Super Admin Users/RBAC", "GET/POST /admin/users, GET/POST /admin/roles, GET/POST /admin/permissions, PATCH /admin/users/:id/status, POST /admin/users/:id/reset-password"],
        ["Super Admin Tournament Builder", "GET/POST/PATCH /tournaments, PATCH /management/tournaments/:slug/team-size, POST /tournaments/:id/fixtures/generate, POST /tournaments/:id/publish, GET /public/tournaments/:slug/bracket"],
        ["Super Admin CMS", "GET/POST/PATCH /cms/pages, /cms/sponsors, /cms/gallery, /cms/blogs, /cms/faqs, POST /cms/publish"],
        ["Management Dashboard", "GET /management/dashboard, GET /management/tournaments/:id/overview, GET /matches/live, GET /registrations?status=pending"],
        ["Management Registration Approval", "POST /management/registrations/:registrationId/approve, POST /management/registrations/:registrationId/reject. Accepted teams feed bracket allocation."],
        ["Manager Bracket Allocation Workspace", "GET /management/brackets/:tournamentSlug, POST /management/brackets/:tournamentSlug/save, POST /management/brackets/:tournamentSlug/advance-winner, POST /management/brackets/:tournamentSlug/notify"],
        ["Public/User Rounds Viewer", "GET /public/tournaments/:slug/bracket. Upcoming tournaments show locked blank round circles and connector lines only; live/existing tournaments show published team progression and score details."],
        ["Match Control", "GET /matches/:id, PATCH /matches/:id/status, POST /matches/:id/events, PATCH /matches/:id/score, GET /matches/:id/timeline"],
        ["Player Control", "GET /teams/:id, PATCH /players/:id, POST /teams/:id/roster, POST /players/:id/documents, GET /players/:id/statistics"],
        ["Announcements", "POST /announcements, GET /announcements, POST /notifications/send, GET /notifications/templates"],
        ["Reports", "GET /reports/tournaments, GET /reports/registrations, GET /reports/payments, GET /reports/live-score, GET /reports/export"],
    ], [2300, 7060]))

    body.append(p("9. Critical Workflow APIs", style="Heading1"))
    body.append(image_paragraph("rIdImage4", "Auth Registration Payment Notification Workflow", "Critical API workflow from login to registration, payment webhook, and notification", 4))
    body.append(table([
        ["Workflow", "API Sequence"],
        ["Login", "POST /auth/login -> create session in Redis -> return access token and refresh token -> DB-3 login event."],
        ["OTP Login or Verification", "POST /auth/otp/send -> SMS provider adapter -> POST /auth/otp/verify -> mark verified -> audit event."],
        ["Team Registration", "GET /public/tournaments/:slug -> read team_size -> POST /registrations/team or POST /registrations with members[] -> validate exact roster count including captain/sub-captain -> upload documents -> pending approval -> notify manager."],
        ["Approval", "PATCH /registrations/:id/approve or reject -> DB-1 status change -> DB-2 mirror -> DB-3 approval audit -> notification queue."],
        ["Payment", "POST /payments/orders -> Razorpay order -> frontend checkout -> POST /payments/verify -> pending confirmation."],
        ["Payment Webhook", "POST /payments/webhook/razorpay -> signature verify -> idempotent status update -> receipt/invoice -> notification."],
        ["Live Score", "POST /matches/:id/events -> DB-1 match event -> Redis active state -> Socket.IO broadcast -> DB-3 operator audit."],
        ["Bracket Allocation", "POST /management/registrations/:id/approve -> accepted team appears in bracket workspace -> GET /management/brackets/:slug -> manager edits nodes/connections -> POST /management/brackets/:slug/save -> public bracket updates."],
        ["Winner Progression", "PATCH /matches/:id/score or POST /matches/:id/events -> result calculation -> POST /management/brackets/:slug/advance-winner when approved -> next round node updated -> public rounds viewer refreshes."],
        ["Manual Bracket Notification", "POST /management/brackets/:slug/notify with channels sms/email/both -> local notification event now, external SMS/email provider later."],
    ], [2300, 7060]))

    body.append(p("10. Sport-Specific Tournament, Registration Member, and Bracket APIs", style="Heading1"))
    body.append(p("This section records the new frontend/backend update: selected sport pages show only that sport, upcoming public rounds show clean locked bracket circles with connector lines, and management users control accepted teams through a bracket workspace. Current local backend uses Python FastAPI and SQLite/local storage; production can map the same contracts to Node/Express/PostgreSQL."))
    body.append(table([
        ["API", "Auth", "Purpose", "Request / Response Notes"],
        ["GET /api/v1/public/sports/:slug", "Public", "Return selected sport details and grouped tournaments in exact order: upcoming, live, existing/completed.", "Response includes sport, tournaments[], groups.upcoming[], groups.live[], groups.existing[]. Selected sport page must not display tournaments from other sports."],
        ["GET /api/v1/public/tournaments/:slug", "Public", "Return tournament detail used by status-aware pages and registration.", "Response includes status, sport, teams, capacity, team_size, prize, venue/date/image metadata. Registration form uses team_size."],
        ["GET /api/v1/public/tournaments/:slug/bracket", "Public", "Return published bracket nodes/connections for Rounds page.", "Upcoming tournaments render blank locked circles and connector lines only. Live/existing tournaments can render teams, rounds, score records, and winner paths."],
        ["POST /api/v1/registrations", "Public with validation / CAPTCHA in production", "Create tournament registration with team details and member details.", "Body includes tournament_slug, team_name, captain_name, email, phone, members[]. members[] count must equal tournament.team_size and includes captain plus sub-captain."],
        ["POST /api/v1/management/registrations/:registrationId/approve", "Management or Super Admin", "Approve registration after payment/document review.", "Updates registration status to accepted, writes audit log, and makes team available to bracket allocation."],
        ["POST /api/v1/management/registrations/:registrationId/reject", "Management or Super Admin", "Reject registration with audit trail.", "Updates registration status to rejected, writes audit log, and should trigger manual/queued notification."],
        ["PATCH /api/v1/management/tournaments/:slug/team-size", "Management or Super Admin", "Set members-per-team on tournament create/configuration page.", "Body: { team_size: number }. Accepted range: 2-60. Registration uses this number for member-name inputs and backend validation."],
        ["GET /api/v1/management/brackets/:tournamentSlug", "Management or Super Admin", "Load manager bracket allocation workspace.", "Response includes acceptedTeams[], nodes[], connections[], notifications[]. Accepted registrations feed the team list."],
        ["POST /api/v1/management/brackets/:tournamentSlug/save", "Management or Super Admin", "Persist bracket nodes, connections, rounds, pair state, cancel/rematch state, and winner paths.", "Body includes nodes[], connections[], publish, audit_reason. No autosave; frontend enables Save only after changes."],
        ["POST /api/v1/management/brackets/:tournamentSlug/advance-winner", "Management or Super Admin", "Move winner into next round from score result or approved override.", "Body includes winner_team, target_node_id, audit_reason. Manual override requires role permission and audit reason."],
        ["POST /api/v1/management/brackets/:tournamentSlug/notify", "Management or Super Admin", "Send manual saved-bracket notification.", "Body includes channels[] such as sms/email, audience, message. Local implementation stores notification event; production adapter sends SMS/email."],
    ], [2050, 1300, 2750, 3260]))
    body.append(rich_callout("Bracket API Rendering Rule", [
        "Public upcoming rounds must not expose manager controls, team bank, plus icons, or editable nodes. They render only round labels, blank circular slots, and clean connector lines until the manager publishes teams.",
        "Manager workspace can display accepted teams, editable circular nodes, add/remove actions, save button, winner advance, cancel/rematch, and manual notification controls."
    ]))

    body.append(p("11. Socket.IO Event Contract", style="Heading1"))
    body.append(table([
        ["Event", "Purpose"],
        ["client:joinTournament", "Public users, admin users, and management users join tournament room for updates."],
        ["client:joinMatch", "Viewer or operator joins match room for live score and timeline events."],
        ["score:eventCreated", "Server broadcasts new score event, card, foul, set, wicket, over, possession, substitution, or timeline item."],
        ["score:stateUpdated", "Server broadcasts current scoreboard snapshot after every accepted scoring mutation."],
        ["match:statusChanged", "Server broadcasts scheduled, live, paused, completed, abandoned, or result-approved state."],
        ["registration:statusChanged", "Admin and management dashboards receive approval/rejection/payment status changes."],
        ["announcement:published", "Tournament room receives public or role-scoped announcement."],
        ["dashboard:metricUpdated", "Super Admin and management dashboards receive live counters and alerts."],
    ], [2600, 6760]))

    body.append(p("12. Webhook API Rules", style="Heading1"))
    body.extend(bullets([
        "Webhook routes must be public URLs, but protected by provider signature validation, secret tokens, replay protection, and idempotency.",
        "Razorpay webhook should update payment, order, refund, invoice, receipt, registration payment status, and DB-3 webhook log records.",
        "WhatsApp webhook should verify Meta webhook token during setup and then process inbound message/status callbacks safely.",
        "Email and push delivery callbacks should update notification logs, not user-facing state unless the business workflow requires it.",
        "Every webhook payload should be stored in DB-3 with provider, event type, provider event ID, checksum, status, and processed timestamp.",
    ]))

    body.append(p("13. API Security Requirements", style="Heading1"))
    body.append(table([
        ["Requirement", "Implementation Rule"],
        ["JWT", "Short-lived access tokens, rotating refresh tokens, Redis-backed revoke/session state."],
        ["RBAC", "Permission checks at route and service level; tournament-scoped management users cannot access other tournaments."],
        ["Rate Limiting", "Separate limits for auth, OTP, payment, public list, upload, webhook, and admin export endpoints."],
        ["CSRF/XSS", "Use secure cookies if refresh tokens are cookie-based, sanitize CMS content, validate all input, and encode output."],
        ["Secrets", "No provider secret in frontend code, logs, or documents uploaded by users. Use environment variables and secret manager."],
        ["PII", "Encrypt sensitive fields where required, never store raw card data, and keep payment provider references only."],
        ["Audit", "Log sensitive read/write, login, export, score correction, payment, webhook, and settings operations in DB-3."],
    ], [2300, 7060]))

    body.append(p("14. API Documentation Deliverables", style="Heading1"))
    body.extend(bullets([
        "Create OpenAPI/Swagger documentation for every REST route with method, path, auth, role, request body, query params, response, validation, and error codes.",
        "Create Postman collection grouped by Auth, Public, Tournament, Registration, Payment, Live Score, Admin, CMS, Notification, Reports, Logs, and Webhooks.",
        "Create Socket.IO event documentation with event name, room, payload, acknowledgement, permission rule, and sample response.",
        "Create environment variable documentation for local, staging, and production provider credentials.",
        "Create webhook setup guide with local tunneling, staging URL, production URL, signature validation, and replay testing.",
    ]))

    body.append(p("15. External API Source Reference", style="Heading1"))
    body.append(table([
        ["Provider", "Official Reference"],
        ["Razorpay API", "https://razorpay.com/docs/api/"],
        ["Razorpay Authentication", "https://razorpay.com/docs/api/authentication/"],
        ["Razorpay Webhooks", "https://razorpay.com/docs/webhooks/"],
        ["Twilio Messaging", "https://www.twilio.com/docs/messaging/api"],
        ["Meta WhatsApp Cloud API", "https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started"],
        ["Resend Email API", "https://resend.com/docs/api-reference/introduction"],
        ["SendGrid API Keys", "https://www.twilio.com/docs/sendgrid/ui/account-and-settings/api-keys"],
        ["Firebase Cloud Messaging", "https://firebase.google.com/docs/cloud-messaging"],
        ["Cloudinary Upload API", "https://cloudinary.com/documentation/image_upload_api_reference"],
        ["AWS S3 API", "https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html"],
        ["Google Maps API Key", "https://developers.google.com/maps/documentation/javascript/get-api-key"],
        ["Cloudflare Turnstile", "https://developers.cloudflare.com/turnstile/get-started/"],
        ["Google reCAPTCHA", "https://docs.cloud.google.com/recaptcha/docs/create-key-website"],
        ["OpenAI API", "https://platform.openai.com/docs/api-reference"],
        ["Challonge Tournament Registration and Brackets", "https://challonge.com/features/tournaments and https://kb.challonge.com/en/article/hosting-a-sign-up-page-hsknjd/"],
        ["Toornament Organizer Bracket Formats", "https://www.toornament.com/en_US/organizer-software"],
    ], [2600, 6760]))

    body.append(p("16. AI Coding Instructions", style="Heading1"))
    body.extend(bullets([
        "Build provider adapters under backend services so Razorpay, SMS, WhatsApp, email, push, media, maps, CAPTCHA, and AI providers can be swapped by configuration.",
        "Do not expose external provider secrets to React, public website pages, browser logs, or downloadable frontend bundles.",
        "Every internal endpoint must have route validation, service method, repository call, error code, audit behavior, and permission rule.",
        "Use React Query keys that match API modules and page ownership: public, auth, registrations, payments, admin, management, matches, reports, CMS.",
        "Create stable TypeScript shared types for request/response payloads and Socket.IO events.",
        "Write integration tests for auth, registration, payment verification, webhooks, live score events, CMS publishing, and permission boundaries.",
        "No mock APIs, no TODO comments, and no placeholder provider logic in production implementation.",
    ]))
    body.append(rich_callout("API Master Completion Criteria", [
        "This API master document is complete when it gives the team the external API providers to obtain, the dashboard/docs location for each credential, the internal REST modules, frontend page-to-endpoint mapping, Socket.IO events, webhook rules, security requirements, environment variables, documentation deliverables, and coding instructions for Smart Sportz."
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
  <Relationship Id="rIdImage3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/api_internal_module_map.png"/>
  <Relationship Id="rIdImage4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/api_auth_payment_workflow.png"/>
  <Relationship Id="rIdImage5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/api_page_to_endpoint_map.png"/>
</Relationships>'''


def core_xml() -> str:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Smart Sportz - API Master Internal and External API Specification</dc:title>
  <dc:subject>Internal REST APIs, frontend page API details, external API providers, provider credential locations, Socket.IO events, webhooks, API security, and documentation deliverables</dc:subject>
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
        "word/media/api_internal_module_map.png": ASSET_DIR / "api_internal_module_map.png",
        "word/media/api_auth_payment_workflow.png": ASSET_DIR / "api_auth_payment_workflow.png",
        "word/media/api_page_to_endpoint_map.png": ASSET_DIR / "api_page_to_endpoint_map.png",
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
