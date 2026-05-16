"""
app/main.py
───────────
FastAPI application factory.
- Mounts all routers under /api/v1
- Adds CORS middleware (accepts requests from any Node.js backend)
- Serves a health endpoint at /health
- Ensures upload and model directories exist on startup
"""

import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routes import analyze, train, predict, monitor, health

# ── Bootstrap ─────────────────────────────────────────────────────────────────
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ai_engine")


# ── Lifespan (replaces deprecated on_event) ───────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once on startup; yields control to the app; runs cleanup on shutdown."""
    for directory in [
        os.getenv("UPLOAD_DIR", "uploads"),
        os.getenv("MODEL_DIR", "saved_models"),
    ]:
        Path(directory).mkdir(parents=True, exist_ok=True)
        logger.info(f"📂  Ensured directory: {directory}")

    logger.info("🚀  AI Audit Engine ready")
    yield
    logger.info("🛑  AI Audit Engine shutting down")


# ── App factory ───────────────────────────────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Audit Dashboard — AI Engine",
        description=(
            "Automatic dataset analysis, AutoML training, predictions, "
            "drift detection, bias monitoring and anomaly detection."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],          # lock this down in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────────
    PREFIX = "/api/v1"
    app.include_router(health.router,   prefix=PREFIX, tags=["Health"])
    app.include_router(analyze.router,  prefix=PREFIX, tags=["Analysis"])
    app.include_router(train.router,    prefix=PREFIX, tags=["Training"])
    app.include_router(predict.router,  prefix=PREFIX, tags=["Predictions"])
    app.include_router(monitor.router,  prefix=PREFIX, tags=["Monitoring"])
    app.include_router(health.router, tags=["Health Compatibility"])
    app.include_router(analyze.router, tags=["Analysis Compatibility"])
    app.include_router(train.router, tags=["Training Compatibility"])
    app.include_router(predict.router, tags=["Predictions Compatibility"])
    app.include_router(monitor.router, tags=["Monitoring Compatibility"])

    # ── Root redirect ─────────────────────────────────────────────────────────
    @app.get("/", include_in_schema=False)
    async def root():
        return JSONResponse({"message": "AI Audit Engine is running", "docs": "/docs"})

    return app


app = create_app()
