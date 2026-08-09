# Smart Sportz Backend

Python FastAPI backend for the Smart Sportz frontend.

This backend intentionally uses local services only:

- DB-1 primary SQLite database in `storage/smart_sportz.db`
- DB-2 mirror SQLite database in `storage/smart_sportz_mirror.db`
- DB-3 audit/event SQLite database in `storage/smart_sportz_audit.db`
- JSON backups in `storage/backups`
- Local file uploads in `storage/uploads`
- Local simulated payments
- Local DB-3 audit logs
- WebSocket live score updates

External APIs such as Razorpay, email, SMS, WhatsApp, Firebase, Cloudinary, and Maps are not connected yet. They can be added later behind provider adapter services.

## Database Architecture

Local development uses SQLite files to model the production PostgreSQL design:

- **DB-1 Primary Operational DB**: normal editable application data for users, tournaments, registrations, payments, brackets, live scores, CMS, news, and managers.
- **DB-2 Mirror/Backup DB**: copied from DB-1 by the backend mirror worker. Normal API routes do not write to this database.
- **DB-3 Audit/Event Log DB**: append-focused audit trail for login, logout, registration approval, CMS edits, manager changes, mirror sync, and backup events.
- **Redis**: configured by `REDIS_URL` for production-ready session, cache, rate-limit, OTP/temp, and live-score fast-state planning.

Super admin database endpoints:

```text
GET  /api/v1/admin/database/status
GET  /api/v1/admin/database/compare
POST /api/v1/admin/database/mirror/sync
POST /api/v1/admin/database/backups/json
GET  /api/v1/admin/logs
```

Production should map `DATABASE_PATH`, `MIRROR_DATABASE_PATH`, and `AUDIT_DATABASE_PATH` to separate PostgreSQL connection strings with DB-2 write access granted only to replication/backup workers.

For Supabase local testing, use PostgreSQL mode with environment variables instead of committing credentials:

```powershell
$env:DATABASE_BACKEND="postgres"
$env:DATABASE_URL="postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres?sslmode=require"
$env:MIRROR_DATABASE_URL=$env:DATABASE_URL
$env:AUDIT_DATABASE_URL=$env:DATABASE_URL
$env:POSTGRES_PRIMARY_SCHEMA="primary_app"
$env:POSTGRES_MIRROR_SCHEMA="mirror_backup"
$env:POSTGRES_AUDIT_SCHEMA="audit_event"
python -m app.main
```

In Supabase mode the backend creates three schemas in the same Supabase PostgreSQL database:

- `primary_app` for live editable application data.
- `mirror_backup` for DB-2 mirror data written only by the mirror worker/admin sync route.
- `audit_event` for DB-3 login, audit, and system events.

## Run

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

API docs:

```text
http://127.0.0.1:8000/docs
```

Health:

```text
http://127.0.0.1:8000/api/v1/health
```

Seeded login:

```text
admin@smartsportz.in / admin123
manager@smartsportz.in / manager123
user@smartsportz.in / user123
```
