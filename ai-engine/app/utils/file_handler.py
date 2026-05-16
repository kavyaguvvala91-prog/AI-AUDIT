"""Utilities for runtime directory creation and uploaded file persistence."""

from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.utils.constants import SAVED_MODELS_DIR, SUPPORTED_UPLOAD_EXTENSIONS, UPLOADS_DIR
from app.utils.helpers import utc_timestamp


def ensure_runtime_directories() -> None:
    """Create runtime directories if they do not already exist."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)


def validate_csv_upload(upload_file: UploadFile) -> None:
    """Validate the uploaded file before it is persisted to disk."""
    if not upload_file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must include a filename.",
        )

    extension = Path(upload_file.filename).suffix.lower()
    if extension not in SUPPORTED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are supported.",
        )


async def persist_upload_file(upload_file: UploadFile) -> tuple[str, Path]:
    """Persist the uploaded dataset and return the generated dataset ID and file path."""
    validate_csv_upload(upload_file)
    ensure_runtime_directories()

    dataset_id = uuid4().hex
    safe_name = Path(upload_file.filename).name
    stored_filename = f"{dataset_id}__{safe_name}"
    destination = UPLOADS_DIR / stored_filename

    file_bytes = await upload_file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded CSV file is empty.",
        )

    destination.write_bytes(file_bytes)
    await upload_file.close()
    return dataset_id, destination


def write_metadata_file(dataset_id: str, metadata: dict) -> Path:
    """Write a metadata sidecar file so future routes can reuse upload context."""
    ensure_runtime_directories()
    metadata_path = UPLOADS_DIR / f"{dataset_id}.meta.json"
    payload = {
        **metadata,
        "dataset_id": dataset_id,
        "updated_at": utc_timestamp(),
    }
    metadata_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return metadata_path


def read_metadata_file(dataset_id: str) -> dict:
    """Load dataset metadata from disk."""
    metadata_path = UPLOADS_DIR / f"{dataset_id}.meta.json"
    if not metadata_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset metadata not found for dataset_id='{dataset_id}'.",
        )

    return json.loads(metadata_path.read_text(encoding="utf-8"))
