from __future__ import annotations

from fastapi import APIRouter, Response

from app.api.routes import admin, auth, content, likes, live, management, payments, public, registrations, storage, user
from app.core.config import settings
from app.core.responses import ok
from app.db.database import audit_db_path, db_path, mirror_db_path, using_postgres
from app.services.runtime_state import runtime_state
from app.services.metrics import prometheus_text

api_router = APIRouter(prefix="/api/v1")


@api_router.get("/health", tags=["system"])
def health():
    if using_postgres():
        database = {
            "backend": "postgres",
            "primary": settings.postgres_primary_schema,
            "mirror": settings.postgres_mirror_schema,
            "audit": settings.postgres_audit_schema,
            "urlConfigured": bool(settings.database_url),
        }
    else:
        database = {
            "backend": "sqlite",
            "primary": str(db_path()),
            "mirror": str(mirror_db_path()),
            "audit": str(audit_db_path()),
        }
    return ok({
        "status": "healthy",
        "database": database,
        "runtimeState": runtime_state.status(),
    })


@api_router.get("/metrics", tags=["system"], include_in_schema=False)
def metrics():
    return Response(prometheus_text(), media_type="text/plain; version=0.0.4; charset=utf-8")


api_router.include_router(auth.router)
api_router.include_router(content.router)
api_router.include_router(public.router)
api_router.include_router(registrations.router)
api_router.include_router(payments.router)
api_router.include_router(admin.router)
api_router.include_router(management.router)
api_router.include_router(likes.router)
api_router.include_router(live.router)
api_router.include_router(storage.router)
api_router.include_router(user.router)
