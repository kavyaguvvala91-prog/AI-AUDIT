"""
app/monitoring/bias_detector.py
────────────────────────────────
BiasDetector: performs a fairness audit by computing per-group outcome rates
for each sensitive attribute (e.g., gender, race).

Metrics computed per group:
  • positive_rate  — fraction of rows with the "positive" class / above-median value
  • count          — number of rows in the group
  • proportion     — fraction of total dataset

Bias is flagged when the difference in positive_rate between any two groups
of the same attribute exceeds BIAS_THRESHOLD (10 percentage points by default).

This is a hackathon-friendly implementation of Demographic Parity.
For production, consider full Fairlearn or AIF360 integration.
"""

import logging
from typing import Any, Dict, List

import numpy as np
import pandas as pd

from app.models.schemas import BiasResult
from app.utils.file_utils import load_csv

logger = logging.getLogger(__name__)

BIAS_THRESHOLD = 0.10  # 10 pp difference triggers a bias flag


class BiasDetector:

    def audit(
        self,
        file_path: str,
        target_column: str,
        sensitive_attributes: List[str],
    ) -> BiasResult:
        df = load_csv(file_path)

        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found.")

        missing_attrs = [a for a in sensitive_attributes if a not in df.columns]
        if missing_attrs:
            raise ValueError(f"Sensitive attribute columns not found: {missing_attrs}")

        # Determine the "positive" outcome threshold
        target = df[target_column]
        is_numeric_target = pd.api.types.is_numeric_dtype(target)
        positive_threshold = float(target.median()) if is_numeric_target else None

        group_metrics: Dict[str, Dict[str, Any]] = {}
        bias_detected = False

        for attr in sensitive_attributes:
            groups = df.groupby(attr, observed=True)
            attr_metrics: Dict[str, Any] = {}

            positive_rates = []

            for group_val, group_df in groups:
                t = group_df[target_column]
                if is_numeric_target:
                    pos_rate = float((t > positive_threshold).mean())
                else:
                    # For categorical targets, use the modal class as "positive"
                    modal_class = target.mode()[0]
                    pos_rate = float((t == modal_class).mean())

                attr_metrics[str(group_val)] = {
                    "count": int(len(group_df)),
                    "proportion": round(len(group_df) / len(df), 4),
                    "positive_rate": round(pos_rate, 4),
                }
                positive_rates.append(pos_rate)

            # Check if max spread exceeds threshold
            if positive_rates:
                spread = max(positive_rates) - min(positive_rates)
                attr_metrics["_bias_spread"] = round(spread, 4)
                attr_metrics["_bias_flagged"] = spread > BIAS_THRESHOLD
                if spread > BIAS_THRESHOLD:
                    bias_detected = True
                    logger.warning(
                        f"Bias detected in '{attr}': spread={spread:.2%} > threshold={BIAS_THRESHOLD:.2%}"
                    )

            group_metrics[attr] = attr_metrics

        logger.info(
            f"Bias audit complete: {len(sensitive_attributes)} attributes, bias_detected={bias_detected}"
        )

        return BiasResult(
            target_column=target_column,
            sensitive_attributes=sensitive_attributes,
            bias_detected=bias_detected,
            group_metrics=group_metrics,
        )