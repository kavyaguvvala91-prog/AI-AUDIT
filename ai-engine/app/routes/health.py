"""
app/routes/health.py
─────────────────────
Health-check endpoints consumed by the Node.js backend and load balancers.

  GET /api/v1/health        — liveness probe
  GET /api/v1/health/ready  — readiness probe (checks model dir exists)
"""

import os
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..utils.config import settings

router = APIRouter()


@router.get("/health")
async def liveness():
    """Basic liveness probe — if this returns, the process is running."""
    return JSONResponse({
        "success": True,
        "message": "AI Audit Engine is running",
        "data": {
            "status": "ok",
            "env": os.getenv("ENV", "development"),
            "model_dir": str(settings.MODEL_DIR),
            "upload_dir": str(settings.UPLOAD_DIR),
        },
    })


@router.get("/health/ready")
async def readiness():
    """Readiness probe — checks that required directories are accessible."""
    issues = []

    for d in [settings.MODEL_DIR, settings.UPLOAD_DIR]:
        if not Path(d).exists():
            issues.append(f"Directory missing: {d}")

    if issues:
        return JSONResponse(
            status_code=503,
            content={"success": False, "message": "Not ready", "issues": issues},
        )

    return JSONResponse({"success": True, "message": "Ready", "data": {"status": "ok"}})