from __future__ import annotations

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.schema import init_schema
from app.db.seed import seed_data, seed_operational_data


def create_app() -> FastAPI:
    init_schema()
    seed_data()
    seed_operational_data()

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
    app.include_router(api_router)
    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
