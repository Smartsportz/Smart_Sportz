# Smart Sportz Backend

Python FastAPI backend for the Smart Sportz frontend.

This backend intentionally uses local services only:

- SQLite database in `storage/smart_sportz.db`
- Local file uploads in `storage/uploads`
- Local simulated payments
- Local audit logs
- WebSocket live score updates

External APIs such as Razorpay, email, SMS, WhatsApp, Firebase, Cloudinary, and Maps are not connected yet. They can be added later behind provider adapter services.

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
