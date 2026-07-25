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


OUT = Path("docs/Smart_Sportz_Complete_Backend_Logic_Planning_Blueprint.docx")
ASSET_DIR = Path("docs/assets")


def bullets(items: list[str]) -> list[str]:
    return [p(item, num_id=1) for item in items]


def rows(title: str, items: list[tuple[str, str]]) -> list[str]:
    body: list[str] = [p(title, style="Heading2")]
    body.append(table([["Area", "Backend Planning Detail"], *items], [2300, 7060]))
    return body


def document_xml() -> str:
    body: list[str] = []

    body.append(p("SMART SPORTZ - COMPLETE BACKEND LOGIC PLANNING BLUEPRINT", style="Title"))
    body.append(p("Enterprise Sports Tournament Management Platform", style="Subtitle"))
    body.append(p("Backend architecture, logic, workflow, security, database, API, real-time, integration, and deployment planning document", style="Subtitle"))
    body.append(p(""))
    body.append(table([
        ["Document", "Complete Backend Logic Planning Blueprint"],
        ["Project", "Smart Sportz"],
        ["Purpose", "Describe the complete backend plan without implementing backend code."],
        ["Backend Stack", "Node.js, Express, TypeScript, Socket.IO, PostgreSQL, Prisma, Redis, Razorpay, queues, Docker, Nginx, CI/CD."],
        ["Data Strategy", "DB-1 editable primary store, DB-2 immutable mirror/backup store, DB-3 software log/event store, encrypted JSON backup exports, Redis cache/session/live state."],
        ["Audience", "Backend engineers, database architect, DevOps engineer, frontend engineers, QA, security reviewer, and product owner."],
        ["Date", "July 23, 2026"],
        ["Version", "1.0"],
    ], [2400, 6960], header=False, fill="FFFFFF"))
    body.append(p(""))
    body.append(rich_callout("Planning Intent", [
        "This document is a backend implementation plan only. It describes what the backend should do, how modules should communicate, how data should move, and which rules must be enforced.",
        "It does not implement the backend. The goal is to give the development team a clear source of truth before coding starts."
    ]))

    body.append(p("1. Backend Vision", style="Heading1"))
    body.append(p("The Smart Sportz backend must operate as the enterprise control layer for public tournament discovery, registrations, payments, Super Admin actions, Management User operations, live score intelligence, CMS publishing, reports, audit trails, and production monitoring. It should be modular, secure, testable, scalable, and ready for real tournament operations."))
    body.extend(bullets([
        "Keep the backend stateless at the API layer so multiple instances can run behind Nginx or a cloud load balancer.",
        "Use feature modules with controller, service, repository, validation, DTO, and route boundaries.",
        "Place all business rules inside service logic, not inside route files or React pages.",
        "Use PostgreSQL and Prisma for transactional data, Redis for sessions/cache/live state/queues, and Socket.IO for real-time scoring.",
        "Record audit and event logs for all sensitive operations, including login, permission changes, payments, score corrections, approvals, and exports.",
    ]))

    body.append(p("2. Backend System Topology", style="Heading1"))
    body.append(p("The backend topology separates frontend clients, API routing, middleware, services, repositories, databases, Redis, Socket.IO, queues, external providers, and operational monitoring."))
    body.append(image_paragraph("rIdImage1", "Backend System Topology", "Smart Sportz backend topology with API, services, databases, Redis, Socket.IO, jobs, providers, and monitoring", 1))

    body.extend(rows("3. Architecture Principles", [
        ("Clean boundaries", "Routes handle URL mapping, middleware handles cross-cutting checks, controllers adapt HTTP requests, services own business decisions, repositories own data access."),
        ("Security first", "Every sensitive HTTP route and Socket.IO action must enforce authentication, RBAC permission, resource scope, validation, rate limits, and audit logging."),
        ("Event-aware design", "Live score updates, payment webhooks, notifications, report exports, and audit records should be modeled as events that can be retried, replayed, and investigated."),
        ("Transactional integrity", "Use database transactions for registration, payment preparation, approvals, score finalization, refunds, and multi-entity admin changes."),
        ("Provider isolation", "Razorpay, SMS, WhatsApp, email, push, storage, maps, and optional AI providers must sit behind backend adapter services so providers can be replaced later."),
        ("Frontend contract stability", "All APIs should use versioned routes, typed DTOs, predictable errors, pagination rules, and OpenAPI documentation."),
    ]))

    body.append(p("4. Clean Architecture Request Flow", style="Heading1"))
    body.append(image_paragraph("rIdImage2", "Clean Architecture Flow", "HTTP request moves through route, middleware, validation, controller, service, repository, database, audit, and response", 2))
    body.extend(bullets([
        "Request starts at /api/v1 route with request ID and correlation ID.",
        "Middleware applies CORS, body limits, auth, RBAC, scope checks, validation, rate limiting, and file checks.",
        "Controller maps request data into typed service DTOs and never contains business rules.",
        "Service validates business state, opens transactions when needed, calls repositories and provider adapters, emits domain events, and records audit intent.",
        "Repository performs Prisma queries with explicit filters, pagination, soft-delete behavior, indexes, and tenant/tournament scoping.",
        "Response uses one standard envelope with data, message, meta, and error code when applicable.",
    ]))

    body.extend(rows("5. Recommended Backend Folder Structure", [
        ("src/app", "Express app bootstrap, middleware registration, global error handler, route mounting, API docs, health routes."),
        ("src/config", "Environment validation, database, Redis, Razorpay, storage, notification providers, CORS, security, feature flags."),
        ("src/modules/auth", "Login, logout, refresh token rotation, forgot password, OTP, remember me, password policy, session revocation."),
        ("src/modules/rbac", "Roles, permissions, role assignment, permission checks, scope rules, admin permission matrix."),
        ("src/modules/tournaments", "Tournament CRUD, formats, stages, rules, fixtures, sponsors, categories, announcements, public visibility."),
        ("src/modules/registrations", "Team/player registration, eligibility, documents, approval, rejection, waitlist, payment handoff."),
        ("src/modules/payments", "Razorpay order creation, payment confirmation, webhook verification, refunds, receipts, invoices, finance reporting."),
        ("src/modules/live-score", "Match lifecycle, score commands, sport adapters, timeline, commentary, statistics, corrections, leaderboard updates."),
        ("src/modules/cms", "Homepage sections, sponsors, gallery, blogs, FAQs, SEO, publishing workflow, content visibility."),
        ("src/modules/notifications", "Email, SMS, WhatsApp, push, in-app notifications, templates, queues, delivery logs."),
        ("src/shared", "Error classes, response helpers, logger, audit helper, DTO utilities, validators, constants, test utilities."),
        ("src/jobs", "Workers, scheduled jobs, report generation, notification dispatch, backup export, cleanup, retry handling."),
        ("src/sockets", "Socket.IO gateway, auth handshake, rooms, event contracts, score broadcasting, live dashboard sync."),
        ("prisma", "Schema, migrations, seed data, model documentation, generated Prisma client."),
    ]))

    body.append(p("6. Module Responsibility Map", style="Heading1"))
    body.append(image_paragraph("rIdImage3", "Internal Backend Module Map", "Internal API modules and their backend boundaries", 3))
    body.append(table([
        ["Module", "Main Service Logic", "Critical Rules"],
        ["Auth and Identity", "Credentials, JWT, refresh token, OTP, password reset, profile.", "Short-lived access token, refresh rotation, login rate limit, audit failed logins."],
        ["RBAC", "Role, permission, resource scope, management access.", "Backend must deny any action without permission even if UI hides it."],
        ["Tournament Engine", "Tournament setup, stages, fixture generation, schedules, results.", "Validate format rules and lock finalized stages."],
        ["Registration", "Team/player intake, documents, approval, capacity.", "Do not overbook capacity; preserve approval history."],
        ["Payment", "Orders, webhooks, refunds, invoice/receipt.", "Webhook signature verification and idempotency are mandatory."],
        ["Live Score", "Event commands, match state, stats, broadcasts.", "Events are source of truth; corrections must be audited."],
        ["CMS", "Public content, gallery, sponsors, blogs, FAQs.", "Draft/published states and role-based publishing."],
        ["Reports", "Exports, analytics, finance, participation, audit.", "Use background jobs for heavy reports."],
        ["Notifications", "Templates, queue, delivery status, retry.", "Never block API response on slow provider delivery."],
    ], [1900, 3900, 3560]))

    body.append(p("7. Authentication and RBAC Logic", style="Heading1"))
    body.append(image_paragraph("rIdImage4", "Auth, RBAC, and Scope Flow", "Authentication, permission, and scope enforcement flow", 4))
    body.extend(bullets([
        "Access token: short lifetime JWT containing user ID, role summary, session ID, and token version.",
        "Refresh token: stored securely as a hashed token record, rotated on refresh, revoked on logout or suspicious activity.",
        "Remember me: extends refresh validity but does not make access tokens long-lived.",
        "OTP and forgot password: expire quickly, rate-limit aggressively, store hashed OTP/token values, and audit attempts.",
        "RBAC: permissions should be action keys such as tournament.create, match.update_score, payment.refund, report.export, cms.publish.",
        "Scope: management users must be limited to assigned tournaments, venues, sports, and modules.",
        "Socket.IO: authenticate the handshake and validate permission before accepting score update, correction, or match control events.",
    ]))

    body.extend(rows("8. User Roles and Permission Planning", [
        ("Super Admin", "Full system control: users, roles, permissions, settings, tournaments, finance, CMS, audit, logs, reports, integrations."),
        ("Admin Staff", "Configured permissions under Super Admin control; can operate selected areas such as tournaments, content, registrations, or reports."),
        ("Management User", "Tournament-scoped operational access for live score, match control, player verification, announcements, documents, and reports."),
        ("Team Manager", "Team registration, roster updates before lock, payment status view, documents, schedules, notifications."),
        ("Player", "Profile, team membership, match schedules, stats, certificates, public/participant notifications."),
        ("Public User", "Public website discovery, tournament detail, live scores, gallery, blogs, sponsors, registration entry points."),
    ]))

    body.append(p("9. Tournament Engine Logic", style="Heading1"))
    body.extend(bullets([
        "Support League, Knockout, Round Robin, and Hybrid tournament formats.",
        "Fixture generation must consider number of teams, groups, venues, time slots, rest time, blackout dates, seeded teams, and sport-specific duration.",
        "Stages should have lifecycle states: draft, generated, published, live, completed, locked.",
        "Changes after publish must be versioned and audited, especially fixture edits, venue changes, result changes, and stage resets.",
        "Result finalization should update standings, leaderboards, qualified teams, certificates, and public website cache.",
    ]))

    body.append(p("10. Registration, Payment, and Approval Logic", style="Heading1"))
    body.append(image_paragraph("rIdImage5", "Registration and Payment Workflow", "Registration, Razorpay order, webhook, approval, invoice, and notification workflow", 5))
    body.append(table([
        ["Step", "Backend Logic"],
        ["Open registration", "Validate tournament status, category capacity, dates, eligibility, and required documents."],
        ["Create draft registration", "Create team/player records in pending state, store registration snapshot, reserve capacity only when business rule allows."],
        ["Calculate amount", "Apply fee, tax, coupon, discounts, late fee, and currency rules."],
        ["Create Razorpay order", "Create payment intent/order, store transaction ID, amount, status, and idempotency key."],
        ["Handle webhook", "Verify signature, deduplicate event, update payment state, generate receipt/invoice, mirror data, write audit log."],
        ["Review approval", "Management/Admin verifies documents, approves, rejects, waitlists, or requests clarification with reason."],
        ["Notify parties", "Queue email/SMS/WhatsApp/push/in-app notifications for payment, approval, rejection, fixture, and schedule changes."],
    ], [1900, 7460]))

    body.append(p("11. Live Score Engine Logic", style="Heading1"))
    body.append(image_paragraph("rIdImage6", "Live Score Event Flow", "Live score event, Redis state, database event store, Socket.IO broadcast, and public update flow", 6))
    body.extend(bullets([
        "Every live scoring action should create a MatchEvent record: event type, match ID, team ID, player ID, value, metadata, timestamp, scorer, and device context.",
        "Sport adapters validate scoring rules for cricket overs/wickets/runs, football goals/cards/fouls, basketball periods/points, volleyball sets, tennis games/sets, and other sports.",
        "Redis stores the active score snapshot, timer, possession, recent timeline, room presence, and reconnect-friendly state.",
        "Socket.IO broadcasts score:update, timeline:add, match:state, stats:update, leaderboard:update, notification:new, and correction:applied events.",
        "Corrections require permission, reason, before/after diff, recalculation, public sync, and immutable audit logging.",
    ]))

    body.append(p("12. Triple Database, Redis, and Backup Architecture", style="Heading1"))
    body.append(image_paragraph("rIdImage7", "Triple Database Topology", "DB-1 primary editable database, DB-2 immutable mirror backup, DB-3 log/event database, Redis, and JSON encrypted backup topology", 7))
    body.append(table([
        ["Store", "Purpose", "Backend Rules"],
        ["DB-1 Primary", "Main editable PostgreSQL data store.", "Allowed to create, edit, delete/soft-delete, approve, correct, and modify according to permissions and business rules."],
        ["DB-2 Mirror Backup", "Immutable mirror/backup database.", "Receives mirrored writes from DB-1 logic or backup worker. No normal edit/delete operations. Used for recovery, verification, and backup confidence."],
        ["DB-3 Log/Event Store", "Software events, login history, audit logs, security logs, webhooks, jobs, and operational events.", "Append-only where possible. Searchable for investigation, compliance, monitoring, and rollback planning."],
        ["Encrypted JSON Backups", "Separate JSON export of table data for DB-1 and DB-2 backup purpose.", "Generated by scheduled job, encrypted at rest, checksum verified, access restricted, never stores plaintext passwords."],
        ["Redis", "Session/cache/live-score/queue state.", "Used for JWT/session support, cache, rate limits, live score snapshots, Socket.IO adapter, queue state, and temporary locks."],
    ], [1800, 2500, 5060]))

    body.append(p("13. Database Domain Planning", style="Heading1"))
    body.append(image_paragraph("rIdImage8", "Database Domain ER Overview", "Domain ER overview for users, tournaments, teams, players, matches, payments, CMS, reports, and audit", 8))
    body.extend(bullets([
        "Use UUID primary keys, createdAt, updatedAt, deletedAt, createdBy, updatedBy, status, and version fields where useful.",
        "Use soft delete for business entities and immutable records for payment, invoice, receipt, match event, score correction, and audit data.",
        "Use indexes for status/date searches, tournament status, team tournament, player team, match venue/time, payment status/date, and public search.",
        "Encrypt sensitive fields such as refresh tokens, OTP values, provider secrets, private notes, selected document metadata, and backup exports.",
        "Passwords must be hashed with a strong password hashing algorithm and never stored in reversible encryption.",
    ]))

    body.extend(rows("14. Internal API Planning", [
        ("Public APIs", "/api/v1/public/tournaments, /sports, /fixtures, /live, /results, /leaderboards, /gallery, /sponsors, /blogs, /faqs."),
        ("Auth APIs", "/api/v1/auth/login, /refresh, /logout, /forgot-password, /verify-otp, /reset-password, /me."),
        ("Registration APIs", "/api/v1/registrations, /documents, /coupons/validate, /status, /approval-history."),
        ("Payment APIs", "/api/v1/payments/orders, /status, /webhooks/razorpay, /refunds, /invoices, /receipts."),
        ("Admin APIs", "/api/v1/admin/users, /roles, /permissions, /tournaments, /sports, /venues, /cms, /finance, /reports, /audit, /settings."),
        ("Management APIs", "/api/v1/management/tournaments/:id, /matches, /players, /registrations, /live-score, /announcements, /reports."),
        ("Live APIs", "/api/v1/live/matches/:id/state, /events, /timeline, /corrections, /statistics, /leaderboard."),
        ("File APIs", "/api/v1/files/upload-policy, /signed-url, /metadata, /archive, /private-download."),
    ]))

    body.append(p("15. External Integration Planning", style="Heading1"))
    body.append(table([
        ["Integration", "Backend Adapter Responsibility"],
        ["Razorpay", "Create order, verify signature, handle webhook, record idempotency, refund, invoice/receipt linkage."],
        ["Email", "Render templates, queue delivery, track status, retry failures, store provider response safely."],
        ["SMS", "OTP and operational alerts with rate limiting and delivery status tracking."],
        ["WhatsApp", "Approved message templates, business notifications, webhook status tracking."],
        ["Push Notifications", "FCM token storage, targeting rules, delivery logs, invalid token cleanup."],
        ["Media Storage", "Upload validation, signed URLs, private documents, image optimization, gallery lifecycle."],
        ["Maps", "Venue geocoding, map display keys, address validation when needed."],
        ["Optional OpenAI", "Report summaries, support assistant, match insights, CMS suggestions with strict admin controls."],
    ], [2200, 7160]))

    body.append(p("16. Background Jobs, Observability, and Recovery", style="Heading1"))
    body.append(image_paragraph("rIdImage9", "Jobs and Observability Flow", "Background jobs, notifications, logging, monitoring, backup, and recovery flow", 9))
    body.extend(bullets([
        "Run jobs for notifications, receipts, invoices, reports, encrypted JSON backup export, DB-2 mirror verification, cleanup, cache warming, and expired token removal.",
        "Use structured logs with correlation IDs across HTTP requests, Socket.IO events, webhooks, jobs, and provider calls.",
        "Expose health endpoints for API, database, Redis, queues, Socket.IO, storage, payment provider, and notification providers.",
        "Monitor error rates, latency, queue depth, failed webhooks, payment mismatches, score correction volume, failed login spikes, backup status, and disk/storage growth.",
        "Define recovery procedures for database restore, JSON backup restore, DB-2 mirror comparison, Redis warmup, and failed deployment rollback.",
    ]))

    body.extend(rows("17. Security Planning", [
        ("JWT and sessions", "Short access tokens, refresh rotation, hashed refresh tokens, device/session records, logout revocation, suspicious activity handling."),
        ("Password and OTP", "Strong password policy, hashing, OTP expiry, OTP rate limit, forgot-password abuse protection."),
        ("RBAC and scopes", "Route permission, resource ownership, tournament assignment, action-level Socket.IO permission, admin audit."),
        ("Input validation", "Zod validation for params, query, body, file metadata, webhook payloads, and service DTOs."),
        ("Payment safety", "Webhook signature verification, idempotency, amount verification, refund authorization, reconciliation reports."),
        ("Data protection", "Encrypted sensitive fields, encrypted JSON backups, private file signed URLs, least privilege DB credentials."),
        ("Web protection", "CORS, CSRF strategy when cookies are used, XSS-safe CMS handling, request limits, rate limits, secure headers."),
        ("Audit", "Log login, logout, failed login, permission changes, admin actions, payment events, score corrections, report exports, provider failures."),
    ]))

    body.append(p("18. Testing Strategy", style="Heading1"))
    body.extend(bullets([
        "Unit tests: validators, services, permission checks, tournament format logic, sport adapters, payment calculations, notification templates.",
        "Integration tests: auth, RBAC, registration, Razorpay webhook, refunds, live score commands, CMS publish, report export, file upload.",
        "Socket tests: handshake auth, room join, score event, permission denial, reconnect state, correction broadcast.",
        "Database tests: migrations, transactions, indexes, soft delete, immutable logs, mirror write verification, backup export checksum.",
        "E2E flows: public registration to payment to approval, management live scoring to public display, admin user role changes, report export.",
    ]))

    body.append(p("19. Implementation Roadmap", style="Heading1"))
    body.append(table([
        ["Stage", "Backend Work"],
        ["Stage 1 - Foundation", "Environment, Express app, Prisma, Redis, logger, error handler, response envelope, auth skeleton, health checks."],
        ["Stage 2 - Identity and RBAC", "Users, roles, permissions, JWT, refresh tokens, OTP, password reset, session tracking, admin audit."],
        ["Stage 3 - Tournament Core", "Sports, venues, tournaments, categories, stages, fixtures, teams, players, public APIs."],
        ["Stage 4 - Registration and Payment", "Registration, documents, eligibility, Razorpay order, webhook, approval, receipts, invoices, notifications."],
        ["Stage 5 - Live Score", "Socket.IO, match lifecycle, sport adapters, event store, Redis snapshots, statistics, corrections, public broadcasts."],
        ["Stage 6 - CMS and Reports", "Homepage, sponsors, gallery, blogs, FAQs, exports, finance reports, participation reports, certificates."],
        ["Stage 7 - Backup and Logs", "DB-2 mirror flow, DB-3 event logs, encrypted JSON backup, backup verification, audit search."],
        ["Stage 8 - Production", "Docker, Nginx, CI/CD, staging, secrets, monitoring, alerts, load testing, recovery runbooks."],
    ], [2300, 7060]))

    body.append(p("20. Backend Completion Checklist", style="Heading1"))
    body.extend(bullets([
        "Every endpoint has authentication requirement, permission key, validation schema, response schema, error codes, and OpenAPI documentation.",
        "Every sensitive mutation writes DB-3 audit/event logs and follows DB-1 to DB-2 mirror/backup rules where applicable.",
        "Every payment webhook is signature-verified, idempotent, reconciled, and logged.",
        "Every live score action is permission checked, event-sourced, Redis-synced, Socket.IO-broadcast, and correction-ready.",
        "Every report/export runs safely through a background job when large or slow.",
        "Every production secret is environment-managed and never committed.",
        "Every database migration has rollback awareness, seed data, and test coverage.",
        "Every deployment includes health checks, structured logs, monitoring, backup verification, and recovery steps.",
    ]))

    body.append(rich_callout("Final Planning Note", [
        "After this document is approved, backend implementation should begin module by module in the roadmap order.",
        "The frontend can continue using the planned API families and Socket.IO contracts while backend endpoints are implemented behind stable /api/v1 boundaries."
    ]))

    body.append(sect_pr())
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{NS_W}" xmlns:r="{NS_R}" xmlns:wp="{NS_WP}" xmlns:a="{NS_A}" xmlns:pic="{NS_PIC}">
  <w:body>
    {''.join(body)}
  </w:body>
</w:document>'''


def document_rels_xml() -> str:
    relationships = [
        ("rIdStyles", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles", "styles.xml"),
        ("rIdNumbering", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering", "numbering.xml"),
        ("rIdSettings", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings", "settings.xml"),
        ("rIdFontTable", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable", "fontTable.xml"),
        ("rIdImage1", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image", "media/backend_master_topology.png"),
        ("rIdImage2", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image", "media/backend_clean_architecture_flow.png"),
        ("rIdImage3", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image", "media/api_internal_module_map.png"),
        ("rIdImage4", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image", "media/backend_auth_rbac_flow.png"),
        ("rIdImage5", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image", "media/backend_registration_payment_flow.png"),
        ("rIdImage6", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image", "media/backend_live_score_event_flow.png"),
        ("rIdImage7", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image", "media/database_triple_db_topology.png"),
        ("rIdImage8", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image", "media/database_er_domain_diagram.png"),
        ("rIdImage9", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image", "media/backend_jobs_observability_flow.png"),
    ]
    body = "\n".join(
        f'  <Relationship Id="{rid}" Type="{rtype}" Target="{target}"/>'
        for rid, rtype, target in relationships
    )
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
{body}
</Relationships>'''


def core_xml() -> str:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Smart Sportz - Complete Backend Logic Planning Blueprint</dc:title>
  <dc:subject>Backend planning document covering modules, workflows, APIs, live score, payments, database, Redis, security, jobs, testing, and deployment.</dc:subject>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>'''


def build() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    assets = {
        "word/media/backend_master_topology.png": ASSET_DIR / "backend_master_topology.png",
        "word/media/backend_clean_architecture_flow.png": ASSET_DIR / "backend_clean_architecture_flow.png",
        "word/media/api_internal_module_map.png": ASSET_DIR / "api_internal_module_map.png",
        "word/media/backend_auth_rbac_flow.png": ASSET_DIR / "backend_auth_rbac_flow.png",
        "word/media/backend_registration_payment_flow.png": ASSET_DIR / "backend_registration_payment_flow.png",
        "word/media/backend_live_score_event_flow.png": ASSET_DIR / "backend_live_score_event_flow.png",
        "word/media/database_triple_db_topology.png": ASSET_DIR / "database_triple_db_topology.png",
        "word/media/database_er_domain_diagram.png": ASSET_DIR / "database_er_domain_diagram.png",
        "word/media/backend_jobs_observability_flow.png": ASSET_DIR / "backend_jobs_observability_flow.png",
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
