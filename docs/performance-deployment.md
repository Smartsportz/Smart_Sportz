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

## Speed And Performance Improvement Roadmap

Use this order so each layer improves real production bottlenecks without changing product behavior unexpectedly.

1. Nginx gateway
   - Serve the built React assets with gzip or Brotli compression, long cache headers for hashed files, and short cache headers for `index.html`.
   - Proxy `/api/v1` to FastAPI with request-size limits, connection keep-alive, timeout controls, and rate limits for login, OTP, and password routes.
   - Terminate TLS at Nginx or the cloud load balancer and forward only HTTPS traffic to the app.

2. WebSocket API for live flows
   - Keep REST for CRUD actions such as login, registration, payments, CMS, and admin setup.
   - Move live score updates, match commentary, notifications, dashboard counters, and manager/admin event feeds to WebSockets.
   - Add reconnect, heartbeat, room subscriptions by tournament or match, and permission checks before joining each channel.

3. Background workers and message broker
   - Add Redis or RabbitMQ as the broker for long-running and bursty jobs.
   - Move WhatsApp/email notifications, image/file processing, backup exports, mirror sync, report generation, and audit-heavy fan-out work into workers.
   - Use Celery, RQ, or Dramatiq with retry policies, dead-letter handling, idempotency keys, and job status records in the DB.

4. Caching and database performance
   - Cache public home, tournament list, sport detail, CMS, and dashboard summary responses with short TTLs and explicit invalidation after admin changes.
   - Add indexes for common filters: `users.email`, `users.role`, `registrations.user_id`, `registrations.tournament_slug`, `payments.registration_id`, manager assignment tables, and live-match lookup columns.
   - Add pagination and search parameters to large admin lists before the tables grow beyond a few thousand rows.

5. Prometheus and Grafana monitoring
   - Expose FastAPI metrics for request count, latency, errors, active WebSocket connections, worker queue depth, job failures, DB query time, cache hit rate, and notification delivery results.
   - Run Prometheus to scrape backend, worker, Redis/message broker, Nginx, and Kubernetes metrics.
   - Build Grafana dashboards for API health, live-score latency, queue performance, DB pressure, frontend error rates, and infrastructure CPU/memory.
   - Add alerts for high 5xx rate, slow p95 API latency, stuck queues, failed workers, DB connection saturation, and abnormal login failures.

6. Frontend performance
   - Keep Vite production builds, code-split large admin modules, lazy-load media-heavy pages, and use optimized image sizes.
   - Virtualize large tables for users, managers, teams, payments, and logs.
   - Use WebSocket event patches for live screens instead of repeatedly refetching full datasets.

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
