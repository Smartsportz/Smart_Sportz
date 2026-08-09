# Smart Sportz Performance Deployment

## Video Quality

The hero video file is not changed by the Docker, Nginx, or Kubernetes setup. Keep future hero videos at `16:9`; recommended production export is `1920x1080` H.264 MP4.

## Local Docker Test

```powershell
docker compose up --build
```

Open:

- Frontend: `http://127.0.0.1:8080`
- Backend health: `http://127.0.0.1:8000/api/v1/health`

The `backend-init` service runs schema creation and seed data once. Runtime backend containers use `INIT_DB_ON_STARTUP=false` so multiple replicas do not repeat database writes.

## Kubernetes Test

Build and tag images:

```powershell
docker build -t smartsportz/backend:latest backend
docker build -t smartsportz/frontend:latest frontend
```

Deploy:

```powershell
kubectl apply -f deploy/kubernetes/smart-sportz.yaml
kubectl -n smart-sportz get pods
```

Optional autoscaling after metrics-server is available:

```powershell
kubectl apply -f deploy/kubernetes/hpa.yaml
```

## Production Notes

- Use Supabase Postgres for testing, then AWS RDS/Aurora for production.
- Use Redis for session, OTP, dashboard cache, public API cache, and rate-limit counters.
- For hosted Redis, set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The backend prefers Upstash REST when both are present, then falls back to `REDIS_URL`, then in-memory local state.

## Production Environment

Render deployment values are present in `render.yaml`, and Vercel frontend values are present in `vercel.json` and `frontend/.env.example`:

- `SUPABASE_URL=https://kuoclwkexuzmkepokite.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY=sb_publishable_7NK_JFApSHcNepEbAaUKTA_NjAoZmQB`
- `UPSTASH_REDIS_REST_URL=https://moved-seahorse-170162.upstash.io`
- `VITE_API_BASE_URL=https://smart-sportz-backend.onrender.com/api/v1`
- Use S3 or compatible object storage for uploaded documents and images before running more than one backend replica.
- Keep backend migrations/seeding as a one-time job, not as part of every application startup.
