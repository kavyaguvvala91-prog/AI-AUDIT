import logging
from typing import Any, Dict, List

import pandas as pd

from ..models.schemas import BiasResult, GroupFairnessMetric
from ..utils.file_utils import load_csv

logger = logging.getLogger(__name__)

BIAS_THRESHOLD = 0.10


class BiasDetector:
    def audit(self, file_path: str, target_column: str, sensitive_attributes: List[str]) -> BiasResult:
        df = load_csv(file_path)

        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found.")

        missing_attrs = [attr for attr in sensitive_attributes if attr not in df.columns]
        if missing_attrs:
            raise ValueError(f"Sensitive attribute columns not found: {missing_attrs}")

        target = df[target_column]
        is_numeric = pd.api.types.is_numeric_dtype(target)
        positive_value = float(target.median()) if is_numeric else target.mode(dropna=True)[0]

        group_metrics: Dict[str, Dict[str, Any]] = {}
        group_summary: Dict[str, List[GroupFairnessMetric]] = {}
        max_spread = 0.0

        for attr in sensitive_attributes:
            attr_metrics: Dict[str, Any] = {}
            summary_rows: List[GroupFairnessMetric] = []
            positive_rates = []

            for group_value, group_df in df.groupby(attr, observed=True):
                values = group_df[target_column]
                if is_numeric:
                    positive_rate = float((values > positive_value).mean())
                else:
                    positive_rate = float((values == positive_value).mean())
                positive_rates.append(positive_rate)
                attr_metrics[str(group_value)] = {
                    "count": int(len(group_df)),
                    "proportion": round(len(group_df) / len(df), 4),
                    "positive_rate": round(positive_rate, 4),
                }

            spread = max(positive_rates) - min(positive_rates) if positive_rates else 0.0
            max_spread = max(max_spread, spread)
            attr_metrics["_bias_spread"] = round(spread, 4)
            attr_metrics["_bias_flagged"] = spread > BIAS_THRESHOLD

            for group_value, metrics in attr_metrics.items():
                if str(group_value).startswith("_"):
                    continue
                parity_gap = abs(metrics["positive_rate"] - min(positive_rates)) if positive_rates else 0.0
                summary_rows.append(
                    GroupFairnessMetric(
                        group=str(group_value),
                        count=metrics["count"],
                        positive_rate=metrics["positive_rate"],
                        parity_gap=round(float(parity_gap), 4),
                        severity=self._severity(parity_gap),
                    )
                )
            group_metrics[attr] = attr_metrics
            group_summary[attr] = summary_rows

        fairness_score = max(0.0, round(1 - max_spread, 4))
        bias_detected = max_spread > BIAS_THRESHOLD
        severity = self._severity(max_spread)

        return BiasResult(
            target_column=target_column,
            sensitive_attributes=sensitive_attributes,
            bias_detected=bias_detected,
            fairness_score=fairness_score,
            bias_severity=severity,
            group_metrics=group_metrics,
            group_summary=group_summary,
        )

    def _severity(self, value: float) -> str:
        if value >= 0.2:
            return "high"
        if value >= 0.1:
            return "medium"
        return "low"
