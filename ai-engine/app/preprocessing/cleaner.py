"""
app/preprocessing/cleaner.py
─────────────────────────────
DataCleaner: handles all data preprocessing steps in a reproducible pipeline.

Steps performed (in order):
  1. Drop columns with > 90 % missing values (useless)
  2. Fill numeric nulls with column median
  3. Fill categorical nulls with the mode (most frequent value)
  4. Label-encode categorical columns
  5. Feature scaling with StandardScaler (fit on train, transform on both)

The fitted encoders + scaler are saved alongside the model so the same
transformations can be applied to prediction / monitoring data later.
"""

import logging
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler

logger = logging.getLogger(__name__)

# Threshold: drop columns that are more than this % missing
MISSING_DROP_THRESHOLD = 0.90


class DataCleaner:
    """
    Stateful preprocessor that can be fitted on training data and then
    applied consistently to new (test / prediction) data.
    """

    def __init__(self):
        self.label_encoders: Dict[str, LabelEncoder] = {}
        self.scaler: StandardScaler = StandardScaler()
        self.dropped_columns: List[str] = []
        self.numeric_columns: List[str] = []
        self.categorical_columns: List[str] = []
        self.medians: Dict[str, float] = {}
        self.modes: Dict[str, str] = {}
        self.feature_columns: List[str] = []   # final ordered feature list (after fitting)
        self._fitted = False

    # ── Public interface ──────────────────────────────────────────────────────

    def fit_transform(self, df: pd.DataFrame, target_col: str) -> np.ndarray:
        """
        Fit the cleaner on df (excluding target_col) and return the
        cleaned feature matrix as a NumPy array.
        """
        features = df.drop(columns=[target_col], errors="ignore").copy()
        features = self._drop_high_missing(features)
        features = self._fill_missing(features, fit=True)
        features = self._encode_categoricals(features, fit=True)
        features = self._keep_numeric(features)
        self.feature_columns = list(features.columns)
        array = self.scaler.fit_transform(features)
        self._fitted = True
        logger.info(
            f"DataCleaner fitted: {len(self.feature_columns)} features "
            f"({len(self.numeric_columns)} numeric, {len(self.label_encoders)} encoded)"
        )
        return array

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """
        Apply the already-fitted cleaner to new data.
        Missing columns are filled with zeros; extra columns are dropped.
        """
        if not self._fitted:
            raise RuntimeError("DataCleaner must be fitted before calling transform()")

        features = df.copy()

        # Drop columns flagged during fitting
        features.drop(columns=self.dropped_columns, errors="ignore", inplace=True)

        # Apply same fill strategy
        features = self._fill_missing(features, fit=False)

        # Apply label encoders (unseen categories → -1)
        for col, le in self.label_encoders.items():
            if col in features.columns:
                features[col] = features[col].astype(str).apply(
                    lambda v: le.transform([v])[0] if v in le.classes_ else -1
                )

        features = self._keep_numeric(features)

        # Align columns to the fitted order (add zeros for any missing cols)
        for col in self.feature_columns:
            if col not in features.columns:
                features[col] = 0.0
        features = features[self.feature_columns]

        return self.scaler.transform(features)

    def encode_target(self, series: pd.Series) -> Tuple[np.ndarray, LabelEncoder | None]:
        """
        For classification targets: label-encode and store the encoder.
        For numeric targets: return as-is.
        """
        if series.dtype == object or str(series.dtype) == "category":
            le = LabelEncoder()
            encoded = le.fit_transform(series.astype(str))
            self.label_encoders["__target__"] = le
            return encoded, le
        return series.values, None

    def decode_target(self, values: np.ndarray) -> np.ndarray:
        """Reverse label-encode target predictions if an encoder exists."""
        le = self.label_encoders.get("__target__")
        if le is not None:
            return le.inverse_transform(values.astype(int))
        return values

    # ── Private helpers ───────────────────────────────────────────────────────

    def _drop_high_missing(self, df: pd.DataFrame) -> pd.DataFrame:
        missing_ratio = df.isnull().mean()
        to_drop = missing_ratio[missing_ratio > MISSING_DROP_THRESHOLD].index.tolist()
        if to_drop:
            logger.info(f"Dropping high-missing columns: {to_drop}")
            self.dropped_columns.extend(to_drop)
            df = df.drop(columns=to_drop)
        return df

    def _fill_missing(self, df: pd.DataFrame, fit: bool) -> pd.DataFrame:
        num_cols = df.select_dtypes(include=np.number).columns.tolist()
        cat_cols = df.select_dtypes(exclude=np.number).columns.tolist()

        for col in num_cols:
            if fit:
                self.medians[col] = df[col].median()
            df[col] = df[col].fillna(self.medians.get(col, 0))

        for col in cat_cols:
            if fit:
                mode_val = df[col].mode()
                self.modes[col] = mode_val[0] if not mode_val.empty else "unknown"
            df[col] = df[col].fillna(self.modes.get(col, "unknown"))

        return df

    def _encode_categoricals(self, df: pd.DataFrame, fit: bool) -> pd.DataFrame:
        cat_cols = df.select_dtypes(exclude=np.number).columns.tolist()
        self.categorical_columns = cat_cols if fit else self.categorical_columns

        for col in cat_cols:
            if fit:
                le = LabelEncoder()
                df[col] = le.fit_transform(df[col].astype(str))
                self.label_encoders[col] = le
            else:
                if col in self.label_encoders:
                    le = self.label_encoders[col]
                    df[col] = df[col].astype(str).apply(
                        lambda v: le.transform([v])[0] if v in le.classes_ else -1
                    )
        return df

    def _keep_numeric(self, df: pd.DataFrame) -> pd.DataFrame:
        """Drop any remaining non-numeric columns (e.g., dates that weren't parsed)."""
        numeric = df.select_dtypes(include=np.number)
        self.numeric_columns = list(numeric.columns) if not self._fitted else self.numeric_columns
        return numeric