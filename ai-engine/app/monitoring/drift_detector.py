"""
app/monitoring/drift_detector.py
──────────────────────────────────
DriftDetector: compares a "current" dataset against a "reference" (baseline)
dataset to detect data drift using the Population Stability Index (PSI).

PSI Interpretation:
  PSI < 0.1   → No significant change
  PSI < 0.2   → Minor change (monitor)
  PSI >= 0.2  → Major drift (retrain recommended)

Only numeric columns shared between both datasets are evaluated.
"""

import logging
from typing import Dict, Tuple

import numpy as np
import pandas as pd

from ..models.schemas import DriftResult
from ..utils.config import settings
from ..utils.file_utils import load_csv

logger = logging.getLogger(__name__)

N_BINS = 10  # number of buckets for PSI calculation
EPSILON = 1e-6  # prevents log(0)


class DriftDetector:

    def detect(
        self, current_file: str, reference_file: str
    ) -> DriftResult:
        df_current = load_csv(current_file)
        df_reference = load_csv(reference_file)

        # Only evaluate numeric columns present in both datasets
        current_num = set(df_current.select_dtypes(include=np.number).columns)
        ref_num = set(df_reference.select_dtypes(include=np.number).columns)
        shared_cols = list(current_num & ref_num)

        if not shared_cols:
            logger.warning("No shared numeric columns found — returning zero drift")
            return DriftResult(
                drifted=False,
                drift_score=0.0,
                threshold=settings.DRIFT_THRESHOLD,
                column_drift={},
            )

        column_psi: Dict[str, float] = {}
        for col in shared_cols:
            psi = self._psi(df_reference[col].dropna(), df_current[col].dropna())
            column_psi[col] = round(psi, 4)
            logger.debug(f"  PSI({col}) = {psi:.4f}")

        mean_psi = float(np.mean(list(column_psi.values())))
        drifted = mean_psi >= settings.DRIFT_THRESHOLD

        logger.info(
            f"Drift detection: mean_PSI={mean_psi:.4f}, "
            f"threshold={settings.DRIFT_THRESHOLD}, drifted={drifted}"
        )

        return DriftResult(
            drifted=drifted,
            drift_score=round(mean_psi, 4),
            threshold=settings.DRIFT_THRESHOLD,
            column_drift=column_psi,
        )

    # ── PSI calculation ───────────────────────────────────────────────────────

    def _psi(
        self, reference: pd.Series, current: pd.Series, n_bins: int = N_BINS
    ) -> float:
        """
        Compute the Population Stability Index between two numeric series.
        Uses the reference distribution to define bin edges.
        """
        # Define bins from reference distribution
        min_val = min(reference.min(), current.min())
        max_val = max(reference.max(), current.max())

        if min_val == max_val:
            return 0.0  # constant column — no drift possible

        bins = np.linspace(min_val, max_val, n_bins + 1)
        bins[0] = -np.inf
        bins[-1] = np.inf

        # Compute relative frequencies
        ref_counts, _ = np.histogram(reference, bins=bins)
        cur_counts, _ = np.histogram(current, bins=bins)

        ref_pct = ref_counts / len(reference)
        cur_pct = cur_counts / len(current)

        # Avoid zero division
        ref_pct = np.where(ref_pct == 0, EPSILON, ref_pct)
        cur_pct = np.where(cur_pct == 0, EPSILON, cur_pct)

        psi = np.sum((cur_pct - ref_pct) * np.log(cur_pct / ref_pct))
        return float(psi)