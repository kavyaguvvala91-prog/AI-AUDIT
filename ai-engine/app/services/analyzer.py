"""
app/services/analyzer.py
─────────────────────────
DatasetAnalyzer: the core intelligence layer that inspects any CSV and returns:
  • Column types (numeric / categorical / datetime)
  • Missing-value statistics
  • Suggested target column (heuristic-based)
  • Problem type (classification vs regression)
  • Class distribution (if classification)
  • Top-5 feature correlations with the target
  • Per-column statistics (mean, std, min, max, top values)
"""

import logging
import re
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from ..models.schemas import AnalyseResponse, ColumnInfo
from ..utils.config import settings
from ..utils.file_utils import load_csv

logger = logging.getLogger(__name__)

# ── Heuristics ────────────────────────────────────────────────────────────────
# Column names that are strong signals for being the target variable
TARGET_KEYWORDS = re.compile(
    r"(target|label|class|output|result|churn|survived|diagnosis|"
    r"default|fraud|outcome|price|salary|revenue|score|rating|status|y$)",
    re.IGNORECASE,
)

# Column names that are almost certainly IDs / metadata (not features)
ID_KEYWORDS = re.compile(
    r"(^id$|_id$|^uuid|^index$|^row|timestamp|created_at|updated_at)",
    re.IGNORECASE,
)


class DatasetAnalyzer:
    """Analyses a CSV file and returns a fully populated AnalyseResponse."""

    def analyse(self, file_path: str, hint_columns: Optional[List[str]] = None) -> AnalyseResponse:
        df = load_csv(file_path)

        numeric_cols, categorical_cols, datetime_cols = self._classify_columns(df)
        missing_summary = self._missing_summary(df)
        column_stats = self._column_stats(df, numeric_cols, categorical_cols)
        suggested_target = self._suggest_target(df, numeric_cols, categorical_cols)
        problem_type = self._problem_type(df, suggested_target)
        class_dist = self._class_distribution(df, suggested_target, problem_type)
        top_corr = self._top_correlations(df, suggested_target, numeric_cols)

        return AnalyseResponse(
            file_path=str(file_path),
            row_count=len(df),
            column_count=len(df.columns),
            columns=df.columns.tolist(),
            numeric_columns=numeric_cols,
            categorical_columns=categorical_cols,
            datetime_columns=datetime_cols,
            column_stats=column_stats,
            missing_summary=missing_summary,
            suggested_target=suggested_target,
            problem_type=problem_type,
            class_distribution=class_dist,
            correlation_top5=top_corr,
        )

    # ── Column classification ─────────────────────────────────────────────────

    def _classify_columns(
        self, df: pd.DataFrame
    ) -> Tuple[List[str], List[str], List[str]]:
        """Split columns into numeric, categorical, and datetime buckets."""
        numeric, categorical, datetimes = [], [], []

        for col in df.columns:
            if ID_KEYWORDS.search(col):
                continue  # skip ID-like columns entirely

            dtype = df[col].dtype
            if pd.api.types.is_datetime64_any_dtype(dtype):
                datetimes.append(col)
            elif pd.api.types.is_numeric_dtype(dtype):
                numeric.append(col)
            else:
                # Attempt to parse as datetime before declaring categorical
                try:
                    pd.to_datetime(df[col], errors="raise", infer_datetime_format=True)
                    datetimes.append(col)
                except Exception:
                    categorical.append(col)

        return numeric, categorical, datetimes

    # ── Missing values ────────────────────────────────────────────────────────

    def _missing_summary(self, df: pd.DataFrame) -> Dict[str, float]:
        """Return {column: missing_percentage} for columns that have any nulls."""
        missing = (df.isnull().mean() * 100).round(2)
        return {col: pct for col, pct in missing.items() if pct > 0}

    # ── Per-column statistics ─────────────────────────────────────────────────

    def _column_stats(
        self,
        df: pd.DataFrame,
        numeric_cols: List[str],
        categorical_cols: List[str],
    ) -> List[ColumnInfo]:
        stats = []
        for col in df.columns:
            null_count = int(df[col].isnull().sum())
            info = ColumnInfo(
                name=col,
                dtype=str(df[col].dtype),
                missing_count=null_count,
                missing_pct=round(null_count / len(df) * 100, 2),
                unique_count=int(df[col].nunique()),
            )
            if col in numeric_cols:
                desc = df[col].describe()
                info.mean = round(float(desc["mean"]), 4)
                info.std = round(float(desc["std"]), 4)
                info.min = round(float(desc["min"]), 4)
                info.max = round(float(desc["max"]), 4)
            elif col in categorical_cols:
                top = df[col].value_counts().head(5)
                info.top_values = [
                    {"value": str(v), "count": int(c)} for v, c in top.items()
                ]
            stats.append(info)
        return stats

    # ── Target suggestion ─────────────────────────────────────────────────────

    def _suggest_target(
        self,
        df: pd.DataFrame,
        numeric_cols: List[str],
        categorical_cols: List[str],
    ) -> Optional[str]:
        """
        Heuristic priority:
          1. Column whose name matches TARGET_KEYWORDS
          2. Last column (very common convention in ML datasets)
        """
        for col in df.columns:
            if TARGET_KEYWORDS.search(col):
                logger.info(f"Target suggested by keyword match: '{col}'")
                return col

        # Fall back to last column if it's categorical or low-cardinality numeric
        last = df.columns[-1]
        if last in categorical_cols:
            return last
        if last in numeric_cols:
            unique_ratio = df[last].nunique() / len(df)
            if unique_ratio < settings.CLASSIFICATION_THRESHOLD:
                return last
            # Even for regression the last column is often the target
            return last

        return None

    # ── Problem type detection ────────────────────────────────────────────────

    def _problem_type(
        self, df: pd.DataFrame, target_col: Optional[str]
    ) -> str:
        if not target_col:
            return "unknown"

        series = df[target_col].dropna()

        # Categorical dtype → always classification
        if series.dtype == object or str(series.dtype) == "category":
            return "classification"

        n_unique = series.nunique()
        unique_ratio = n_unique / len(series)

        # Very few distinct numeric values → treat as classification
        if n_unique <= settings.MAX_CLASSIFICATION_CLASSES and unique_ratio < settings.CLASSIFICATION_THRESHOLD:
            return "classification"

        return "regression"

    # ── Class distribution ────────────────────────────────────────────────────

    def _class_distribution(
        self,
        df: pd.DataFrame,
        target_col: Optional[str],
        problem_type: str,
    ) -> Optional[Dict[str, int]]:
        if target_col and problem_type == "classification":
            dist = df[target_col].value_counts()
            return {str(k): int(v) for k, v in dist.items()}
        return None

    # ── Correlations ──────────────────────────────────────────────────────────

    def _top_correlations(
        self,
        df: pd.DataFrame,
        target_col: Optional[str],
        numeric_cols: List[str],
    ) -> Optional[Dict[str, float]]:
        if not target_col or target_col not in numeric_cols:
            return None

        features = [c for c in numeric_cols if c != target_col]
        if not features:
            return None

        corr = df[features + [target_col]].corr()[target_col].drop(target_col)
        top5 = corr.abs().nlargest(5)
        return {col: round(float(corr[col]), 4) for col in top5.index}