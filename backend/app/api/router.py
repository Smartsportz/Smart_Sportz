from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import admin, auth, live, management, payments, public, registrations, storage
from app.core.responses import ok
from app.db.database import db_path

api_router = APIRouter(prefix="/api/v1")


@api_router.get("/health", tags=["system"])
def health():
    return ok({"status": "healthy", "database": str(db_path())})


api_router.include_router(auth.router)
api_router.include_router(public.router)
api_router.include_router(registrations.router)
api_router.include_router(payments.router)
api_router.include_router(admin.router)
api_router.include_router(management.router)
api_router.include_router(live.router)
api_router.include_router(storage.router)
