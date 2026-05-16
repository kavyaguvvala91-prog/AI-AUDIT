from __future__ import annotations

from typing import List

from ..models.schemas import AutoFixActionResult, RecommendationItem
from ..utils.config import settings


class FixStrategyManager:
    def build_actions(
        self,
        recommendations: List[RecommendationItem],
        approval_granted: bool,
        monitoring_context: dict | None = None,
        quality_context: dict | None = None,
    ) -> List[AutoFixActionResult]:
        monitoring_context = monitoring_context or {}
        quality_context = quality_context or {}
        quality_summary = quality_context.get("summary") or {}

        can_apply = approval_granted or not settings.AUTO_FIX_APPROVAL_REQUIRED
        drift_score = float(((monitoring_context.get("drift") or {}).get("drift_score")) or 0)
        missing_pct = float(quality_summary.get("missing_pct") or 0)
        imbalance_pct = float(quality_summary.get("imbalance_pct") or 0)

        actions: List[AutoFixActionResult] = []
        for item in recommendations:
            if item.code == "drift_retrain":
                allowed = can_apply and drift_score >= settings.AUTO_FIX_DRIFT_THRESHOLD
                actions.append(
                    AutoFixActionResult(
                        action="retrain_model",
                        applied=allowed,
                        details=f"Retrain the active model on recent validated data when drift score {drift_score} exceeds {settings.AUTO_FIX_DRIFT_THRESHOLD}.",
                    )
                )
            elif item.code in {"quality_cleanup", "missing_value_fix"}:
                allowed = can_apply and missing_pct >= settings.AUTO_FIX_MISSING_THRESHOLD
                actions.append(
                    AutoFixActionResult(
                        action="clean_missing_values",
                        applied=allowed,
                        details=f"Repair missing values and invalid placeholders when missing rate {missing_pct} exceeds {settings.AUTO_FIX_MISSING_THRESHOLD}.",
                    )
                )
            elif item.code in {"bias_rebalance", "class_imbalance_oversample"}:
                allowed = can_apply and imbalance_pct >= settings.AUTO_FIX_IMBALANCE_THRESHOLD
                actions.append(
                    AutoFixActionResult(
                        action="rebalance_training_data",
                        applied=allowed,
                        details=f"Rebalance the dataset when imbalance ratio {imbalance_pct} exceeds {settings.AUTO_FIX_IMBALANCE_THRESHOLD}.",
                    )
                )
            elif item.code == "human_review":
                actions.append(
                    AutoFixActionResult(
                        action="route_to_human_review",
                        applied=False,
                        details="Create a manual review queue for low-confidence predictions.",
                    )
                )
            elif item.code == "anomaly_review":
                actions.append(
                    AutoFixActionResult(
                        action="quarantine_anomalies",
                        applied=False,
                        details="Hold anomalous samples outside the automated decision path until the source is validated.",
                    )
                )
            elif item.code == "overfitting_regularization":
                actions.append(
                    AutoFixActionResult(
                        action="tune_regularization",
                        applied=False,
                        details="Regularization changes require model-owner review before automated retraining.",
                    )
                )
        return actions
