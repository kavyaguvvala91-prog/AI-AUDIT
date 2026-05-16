"""Pydantic response models for AI engine endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ApiMessageResponse(BaseModel):
    """Generic API response wrapper for non-resource endpoints."""

    message: str


class UploadResponse(BaseModel):
    """Response returned after a dataset is uploaded successfully."""

    message: str = Field(..., description="Human-readable success message.")
    dataset_id: str = Field(..., description="Generated dataset identifier.")
    original_filename: str = Field(..., description="Filename received from the client.")
    stored_filename: str = Field(..., description="Filename used internally on disk.")
    file_path: str = Field(..., description="Absolute path of the stored CSV file.")
    rows: int = Field(..., ge=0, description="Number of rows detected in the uploaded CSV.")
    columns: int = Field(..., ge=0, description="Number of columns detected in the uploaded CSV.")
    column_names: list[str] = Field(default_factory=list, description="CSV column names.")
    preview: list[dict[str, Any]] = Field(default_factory=list, description="Small preview of dataset rows.")
    uploaded_at: str = Field(..., description="Upload timestamp in ISO 8601 UTC format.")


class DatasetAnalysisResponse(BaseModel):
    """Dataset inspection response used by analysis endpoints."""

    dataset_id: str
    file_path: str
    shape: dict[str, int]
    numeric_columns: list[str]
    categorical_columns: list[str]
    missing_values: dict[str, int]
    possible_target_column: str | None
    problem_type: str
    preview: list[dict[str, Any]] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    """Structured error response for documentation and client consistency."""

    detail: str
