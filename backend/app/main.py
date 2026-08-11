from __future__ import annotations

import os

import uvicorn
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.init_db import initialize_database
from app.services.metrics import metrics_middleware, prometheus_text


def create_app() -> FastAPI:
    if settings.init_db_on_startup:
        initialize_database()

    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="Local Python backend for Smart Sportz. External APIs are intentionally not connected yet.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.middleware("http")(metrics_middleware)
    app.include_router(api_router)

    @app.get("/metrics", include_in_schema=False)
    def metrics():
        return Response(prometheus_text(), media_type="text/plain; version=0.0.4; charset=utf-8")

    return app


app = create_app()


if __name__ == "__main__":
    reload_enabled = os.getenv("FASTAPI_RELOAD", "true").lower() in {"1", "true", "yes", "on"}
    workers = max(1, int(os.getenv("WEB_CONCURRENCY", "1")))
    uvicorn.run(
        "app.main:app",
        host=os.getenv("FASTAPI_HOST", "127.0.0.1"),
        port=int(os.getenv("FASTAPI_PORT", "8000")),
        reload=reload_enabled,
        workers=1 if reload_enabled else workers,
    )
