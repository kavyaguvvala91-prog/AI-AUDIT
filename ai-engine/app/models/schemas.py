"""
app/models/schemas.py
──────────────────────
All Pydantic v2 schemas used across the API.
Centralising them here avoids circular imports and makes the OpenAPI docs richer.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Shared primitives
# ─────────────────────────────────────────────────────────────────────────────

class ColumnInfo(BaseModel):
    name: str
    dtype: str
    missing_count: int
    missing_pct: float
    unique_count: int
    # Only populated for numeric columns
    mean: Optional[float] = None
    std: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    # Only populated for categorical columns
    top_values: Optional[List[Any]] = None


# ─────────────────────────────────────────────────────────────────────────────
# /analyse
# ─────────────────────────────────────────────────────────────────────────────

class AnalyseRequest(BaseModel):
    file_path: str = Field(..., description="Absolute or relative path to the CSV file.")
    columns: Optional[List[str]] = Field(
        default=None,
        description="Optional column list (informational; engine re-reads the file).",
    )


class AnalyseResponse(BaseModel):
    file_path: str
    row_count: int
    column_count: int
    columns: List[str]
    numeric_columns: List[str]
    categorical_columns: List[str]
    datetime_columns: List[str]
    column_stats: List[ColumnInfo]
    missing_summary: Dict[str, float]          # col → missing %
    suggested_target: Optional[str]
    problem_type: str                          # "classification" | "regression" | "unknown"
    class_distribution: Optional[Dict[str, int]]  # only for classification targets
    correlation_top5: Optional[Dict[str, float]]  # top 5 correlations with suggested target


# ─────────────────────────────────────────────────────────────────────────────
# /train
# ─────────────────────────────────────────────────────────────────────────────

class TrainRequest(BaseModel):
    file_path: str
    target_column: str
    config: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Optional overrides: test_size, random_state, model_type.",
    )


class ModelMetrics(BaseModel):
    model_type: str
    problem_type: str
    # Classification metrics
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    # Regression metrics
    rmse: Optional[float] = None
    mae: Optional[float] = None
    r2: Optional[float] = None
    # Shared
    train_samples: int
    test_samples: int
    feature_count: int
    feature_importance: Optional[Dict[str, float]] = None


class TrainResponse(BaseModel):
    model_id: str
    target_column: str
    metrics: ModelMetrics
    model_path: str
    preprocessing_path: str


# ─────────────────────────────────────────────────────────────────────────────
# /predict
# ─────────────────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    file_path: str = Field(..., description="Path to the CSV file to run predictions on.")
    model_id: str = Field(..., description="model_id returned by /train.")


class PredictionRow(BaseModel):
    row_index: int
    prediction: Any
    confidence: Optional[float] = None          # max class probability (classification)
    probabilities: Optional[Dict[str, float]] = None  # class → probability


class PredictResponse(BaseModel):
    model_id: str
    problem_type: str
    total_rows: int
    predictions: List[PredictionRow]
    summary: Dict[str, Any]                     # value counts or basic stats


# ─────────────────────────────────────────────────────────────────────────────
# /monitor  (combined result)
# ─────────────────────────────────────────────────────────────────────────────

class DriftResult(BaseModel):
    drifted: bool
    drift_score: float                          # mean PSI across numeric cols
    threshold: float
    column_drift: Dict[str, float]              # per-column PSI


class BiasResult(BaseModel):
    target_column: str
    sensitive_attributes: List[str]
    bias_detected: bool
    group_metrics: Dict[str, Dict[str, Any]]    # attr → {group_val → metric}


class AnomalyResult(BaseModel):
    total_anomalies: int
    anomaly_rate: float
    anomaly_indices: List[int]


class MonitorResult(BaseModel):
    dataset_id: str
    drift: Optional[DriftResult] = None
    bias: Optional[BiasResult] = None
    anomaly: Optional[AnomalyResult] = None
    confidence_summary: Optional[Dict[str, float]] = None


# ─────────────────────────────────────────────────────────────────────────────
# Individual monitoring request bodies
# ─────────────────────────────────────────────────────────────────────────────

class DriftRequest(BaseModel):
    current_file_path: str
    reference_file_path: str


class BiasRequest(BaseModel):
    file_path: str
    target_column: str
    sensitive_attributes: List[str]


class AnomalyRequest(BaseModel):
    file_path: str
    columns: Optional[List[str]] = None