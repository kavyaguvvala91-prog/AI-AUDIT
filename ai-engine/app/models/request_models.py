"""Pydantic request models shared across AI engine endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class DatasetReferenceRequest(BaseModel):
    """Reference an already uploaded dataset by ID."""

    dataset_id: str = Field(..., min_length=8, description="Unique dataset ID returned by /upload.")


class TrainRequest(BaseModel):
    """Payload for future training requests."""

    dataset_id: str = Field(..., min_length=8, description="Uploaded dataset identifier.")
    target_column: str | None = Field(
        default=None,
        description="Optional explicit target column. If omitted, the engine will infer it.",
    )
    model_name: str | None = Field(
        default=None,
        description="Optional model override such as logistic_regression or random_forest.",
    )


class PredictionRequest(BaseModel):
    """Payload for single or batch inference requests."""

    dataset_id: str = Field(..., min_length=8, description="Dataset or training artifact reference.")
    records: list[dict[str, Any]] = Field(
        ...,
        min_length=1,
        description="List of input feature dictionaries for prediction.",
    )

    @field_validator("records")
    @classmethod
    def validate_records(cls, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Reject empty record objects to prevent malformed inference requests."""
        if any(not record for record in value):
            raise ValueError("Each prediction record must contain at least one feature.")
        return value
