"""
FastAPI application factory for the AI engine.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routes import advanced, analyze, health, monitor, predict, train
from .utils.config import settings


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ai_engine")

DEV_FRONTEND_ORIGIN_REGEX = (
    r"^https?://("
    r"localhost|127\.0\.0\.1|"
    r"192\.168\.\d{1,3}\.\d{1,3}|"
    r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
    r"):(3000|3001|4173|5173)$"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create required runtime directories on startup."""
    for directory in [settings.UPLOAD_DIR, settings.MODEL_DIR]:
        directory.mkdir(parents=True, exist_ok=True)
        logger.info("Ensured directory: %s", directory)

    logger.info("AI Audit Engine ready")
    yield
    logger.info("AI Audit Engine shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Audit Dashboard - AI Engine",
        description=(
            "Automatic dataset analysis, AutoML training, predictions, "
            "drift detection, bias monitoring and anomaly detection."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    frontend_origins = [
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://192.168.1.3:3000",
        ).split(",")
        if origin.strip()
    ]
    frontend_origin_regex = None
    if os.getenv("ENV", "development").lower() != "production":
        frontend_origin_regex = DEV_FRONTEND_ORIGIN_REGEX

    app.add_middleware(
        CORSMiddleware,
        allow_origins=frontend_origins,
        allow_origin_regex=frontend_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    prefix = "/api/v1"
    app.include_router(health.router, prefix=prefix, tags=["Health"])
    app.include_router(analyze.router, prefix=prefix, tags=["Analysis"])
    app.include_router(train.router, prefix=prefix, tags=["Training"])
    app.include_router(predict.router, prefix=prefix, tags=["Predictions"])
    app.include_router(monitor.router, prefix=prefix, tags=["Monitoring"])
    app.include_router(advanced.router, prefix=prefix, tags=["Advanced MLOps"])

    app.include_router(health.router, tags=["Health Compatibility"])
    app.include_router(analyze.router, tags=["Analysis Compatibility"])
    app.include_router(train.router, tags=["Training Compatibility"])
    app.include_router(predict.router, tags=["Predictions Compatibility"])
    app.include_router(monitor.router, tags=["Monitoring Compatibility"])
    app.include_router(advanced.router, tags=["Advanced MLOps Compatibility"])

    @app.get("/", include_in_schema=False)
    async def root():
        return JSONResponse({"message": "AI Audit Engine is running", "docs": "/docs"})

    return app


app = create_app()
