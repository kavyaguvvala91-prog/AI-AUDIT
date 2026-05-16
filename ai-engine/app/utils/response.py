"""
app/utils/response.py
──────────────────────
Helpers that produce a consistent JSON envelope for every API response,
mirroring the Node.js backend's envelope shape for easy frontend consumption.

Success:  { success: true,  message, data }
Error:    { success: false, message, error }
"""

from typing import Any, Optional
from fastapi.responses import JSONResponse


def success(
    data: Any = None,
    message: str = "Success",
    status_code: int = 200,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "message": message,
            "data": data,
        },
    )


def error(
    message: str = "An error occurred",
    error_code: str = "INTERNAL_ERROR",
    status_code: int = 500,
    detail: Optional[str] = None,
) -> JSONResponse:
    body = {
        "success": False,
        "message": message,
        "error": error_code,
    }
    if detail:
        body["detail"] = detail
    return JSONResponse(status_code=status_code, content=body)