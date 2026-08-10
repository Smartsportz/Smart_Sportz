from __future__ import annotations

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
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
