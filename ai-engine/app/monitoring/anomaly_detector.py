"""
app/monitoring/anomaly_detector.py
────────────────────────────────────
AnomalyDetector: uses scikit-learn's IsolationForest to identify outlier rows
in a dataset based on numeric features.

IsolationForest works by randomly isolating observations — anomalies are
isolated faster (fewer splits), so they get a lower anomaly score.

Returns:
  • total_anomalies — count of flagged rows
  • anomaly_rate    — fraction of total rows flagged
  • anomaly_indices — 0-based row indices of anomalous rows
"""

import logging
from typing import List, Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

from ..models.schemas import AnomalyResult
from ..utils.config import settings
from ..utils.file_utils import load_csv

logger = logging.getLogger(__name__)


class AnomalyDetector:

    def detect(
        self,
        file_path: str,
        columns: Optional[List[str]] = None,
    ) -> AnomalyResult:
        df = load_csv(file_path)

        # ── 1. Select numeric columns ──────────────────────────────────────
        num_df = df.select_dtypes(include=np.number)

        if columns:
            # Keep only requested columns that are actually numeric
            valid = [c for c in columns if c in num_df.columns]
            if not valid:
                raise ValueError("None of the specified columns are numeric.")
            num_df = num_df[valid]

        if num_df.empty or num_df.shape[1] == 0:
            logger.warning("No numeric columns found for anomaly detection.")
            return AnomalyResult(total_anomalies=0, anomaly_rate=0.0, anomaly_indices=[])

        logger.info(
            f"Anomaly detection on {num_df.shape[1]} columns: {list(num_df.columns)}"
        )

        # ── 2. Impute + scale ──────────────────────────────────────────────
        imputer = SimpleImputer(strategy="median")
        scaler = StandardScaler()
        X = scaler.fit_transform(imputer.fit_transform(num_df))

        # ── 3. Fit IsolationForest ─────────────────────────────────────────
        iso = IsolationForest(
            contamination=settings.ANOMALY_CONTAMINATION,
            random_state=settings.RANDOM_STATE,
            n_estimators=100,
        )
        labels = iso.fit_predict(X)  # -1 = anomaly, 1 = normal

        anomaly_mask = labels == -1
        anomaly_indices: List[int] = [int(i) for i in np.where(anomaly_mask)[0]]
        total = len(anomaly_indices)
        rate = round(total / len(df), 4)

        logger.info(f"Anomalies found: {total} / {len(df)} rows ({rate:.2%})")

        return AnomalyResult(
            total_anomalies=total,
            anomaly_rate=rate,
            anomaly_indices=anomaly_indices,
        )