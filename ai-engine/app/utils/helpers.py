"""Reusable helper functions for schema inspection and safe serialization."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from .utils.constants import TARGET_COLUMN_KEYWORDS


def utc_timestamp() -> str:
    """Return an ISO 8601 UTC timestamp string."""
    return datetime.now(timezone.utc).isoformat()


def normalize_column_name(column_name: str) -> str:
    """Normalize a column name so heuristic checks are more reliable."""
    return column_name.strip().lower().replace(" ", "_")


def safe_json_value(value: Any) -> Any:
    """Convert pandas and numpy values into JSON-serializable objects."""
    if pd.isna(value):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    return value


def dataframe_preview(dataframe: pd.DataFrame, limit: int = 5) -> list[dict[str, Any]]:
    """Return a small JSON-safe preview of the dataframe."""
    preview_records: list[dict[str, Any]] = []
    for row in dataframe.head(limit).to_dict(orient="records"):
        preview_records.append({key: safe_json_value(value) for key, value in row.items()})
    return preview_records


def detect_numeric_columns(dataframe: pd.DataFrame) -> list[str]:
    """Return columns that contain numeric values."""
    return dataframe.select_dtypes(include=["number"]).columns.tolist()


def detect_categorical_columns(dataframe: pd.DataFrame) -> list[str]:
    """Return columns that should be treated as categorical for ML workflows."""
    return dataframe.select_dtypes(include=["object", "category", "bool"]).columns.tolist()


def detect_missing_values(dataframe: pd.DataFrame) -> dict[str, int]:
    """Count missing values for every column."""
    missing_counts = dataframe.isna().sum().to_dict()
    return {column: int(count) for column, count in missing_counts.items()}


def infer_possible_target_column(columns: Iterable[str]) -> str | None:
    """Guess a likely target column based on common naming conventions."""
    normalized_map = {normalize_column_name(column): column for column in columns}

    for keyword in TARGET_COLUMN_KEYWORDS:
        if keyword in normalized_map:
            return normalized_map[keyword]

    for normalized_name, original_name in normalized_map.items():
        if any(keyword in normalized_name for keyword in TARGET_COLUMN_KEYWORDS):
            return original_name

    return None


def detect_problem_type(
    dataframe: pd.DataFrame,
    target_column: str | None,
) -> str:
    """Infer whether the task is classification or regression."""
    if not target_column or target_column not in dataframe.columns:
        return "unknown"

    target_series = dataframe[target_column].dropna()
    if target_series.empty:
        return "unknown"

    if pd.api.types.is_object_dtype(target_series) or pd.api.types.is_bool_dtype(target_series):
        return "classification"

    unique_values = target_series.nunique()
    sample_size = len(target_series)

    # Small-cardinality integer targets usually indicate classification labels.
    if pd.api.types.is_integer_dtype(target_series) and unique_values <= min(20, max(2, sample_size // 10)):
        return "classification"

    # Low-cardinality numeric targets are often encoded classes.
    if unique_values <= min(10, max(2, sample_size // 20)):
        return "classification"

    return "regression"
