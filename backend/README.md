# Smart Sportz Backend

Python FastAPI backend for the Smart Sportz frontend.

This backend intentionally uses local services only:

- DB-1 primary SQLite database in `storage/smartsportz.db`
- DB-2 mirror SQLite database in `storage/smartsportz_mirror.db`
- DB-3 audit/event SQLite database in `storage/smartsportz_audit.db`
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

Production should keep `DATABASE_PATH`, `MIRROR_DATABASE_PATH`, and `AUDIT_DATABASE_PATH` on persistent disk. DB-1 is the active SQLite database, DB-2 is the mirror/backup SQLite database, and DB-3 is audit/event storage.

The backend is disconnected from Supabase by default. If `storage/smartsportz.db` does not exist, startup creates the SQLite file and schema without clearing existing data. Startup seeding is disabled unless `SEED_DB_ON_STARTUP=true` is explicitly set.

SQLite environment:

```powershell
$env:DATABASE_BACKEND="sqlite"
$env:DATABASE_PATH="storage/smartsportz.db"
$env:MIRROR_DATABASE_PATH="storage/smartsportz_mirror.db"
$env:AUDIT_DATABASE_PATH="storage/smartsportz_audit.db"
python -m app.main
```

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
