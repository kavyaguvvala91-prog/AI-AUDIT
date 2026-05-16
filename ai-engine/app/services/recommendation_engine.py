from __future__ import annotations

from typing import List

from ..models.schemas import RecommendationItem
from ..utils.config import settings


class RecommendationEngine:
    def generate(
        self,
        monitoring_context: dict,
        quality_context: dict | None = None,
        training_context: dict | None = None,
    ) -> List[RecommendationItem]:
        quality_context = quality_context or {}
        training_context = training_context or {}
        recommendations: List[RecommendationItem] = []

        self._append_drift_recommendations(recommendations, monitoring_context.get("drift") or {})
        self._append_bias_recommendations(recommendations, monitoring_context.get("bias") or {})
        self._append_anomaly_recommendations(recommendations, monitoring_context.get("anomaly") or {})
        self._append_confidence_recommendations(recommendations, monitoring_context.get("confidence_summary") or {})
        self._append_quality_recommendations(recommendations, quality_context)
        self._append_training_recommendations(recommendations, training_context)

        deduped: dict[str, RecommendationItem] = {}
        for item in recommendations:
            existing = deduped.get(item.code)
            if existing is None or item.risk_score > existing.risk_score:
                deduped[item.code] = item
        return sorted(deduped.values(), key=lambda item: item.risk_score, reverse=True)

    def _append_drift_recommendations(self, recommendations: List[RecommendationItem], drift: dict) -> None:
        drift_score = float(drift.get("drift_score") or 0)
        if drift.get("drifted") or drift_score >= settings.DRIFT_THRESHOLD:
            recommendations.append(
                RecommendationItem(
                    code="drift_retrain",
                    title="Concept/Data Drift Detected",
                    severity="high" if drift_score >= settings.AUTO_FIX_DRIFT_THRESHOLD else "medium",
                    risk_score=min(100, max(45, int(drift_score * 300))),
                    rationale="Production feature distributions have moved away from the baseline dataset.",
                    recommended_action="Retrain the model on fresher data, validate the most drifted features, and promote the new version only if metrics recover.",
                    auto_fix_available=drift_score >= settings.AUTO_FIX_DRIFT_THRESHOLD,
                )
            )

    def _append_bias_recommendations(self, recommendations: List[RecommendationItem], bias: dict) -> None:
        if bias.get("bias_detected"):
            fairness_score = float(bias.get("fairness_score") or 0.5)
            recommendations.append(
                RecommendationItem(
                    code="bias_rebalance",
                    title="Fairness Risk Detected",
                    severity=bias.get("bias_severity", "high"),
                    risk_score=max(60, int((1 - fairness_score) * 100)),
                    rationale="Protected-group outcome parity has fallen outside the accepted threshold.",
                    recommended_action="Rebalance the training sample, review sensitive features, and validate post-fix fairness before deployment.",
                    auto_fix_available=False,
                )
            )

    def _append_anomaly_recommendations(self, recommendations: List[RecommendationItem], anomaly: dict) -> None:
        anomaly_rate = float(anomaly.get("anomaly_rate") or 0)
        if anomaly_rate > 0.1:
            recommendations.append(
                RecommendationItem(
                    code="anomaly_review",
                    title="Elevated Anomaly Rate",
                    severity="high" if anomaly_rate > 0.2 else "medium",
                    risk_score=min(100, int(anomaly_rate * 500)),
                    rationale="A meaningful share of incoming rows appears out-of-distribution.",
                    recommended_action="Route anomalous samples to review, inspect upstream feeds, and quarantine suspect batches from automated decisions.",
                    auto_fix_available=False,
                )
            )

    def _append_confidence_recommendations(self, recommendations: List[RecommendationItem], confidence: dict) -> None:
        if confidence.get("low_confidence_alert"):
            low_confidence_rate = float(confidence.get("low_confidence_rate") or 0.15)
            recommendations.append(
                RecommendationItem(
                    code="human_review",
                    title="Low Confidence Predictions",
                    severity="medium",
                    risk_score=max(50, min(90, int(low_confidence_rate * 200))),
                    rationale="The model is generating a high volume of uncertain predictions.",
                    recommended_action="Escalate low-confidence cases for human review and recalibrate or retrain the model if uncertainty persists.",
                    auto_fix_available=False,
                )
            )

    def _append_quality_recommendations(self, recommendations: List[RecommendationItem], quality_context: dict) -> None:
        quality_score = quality_context.get("quality_score")
        summary = quality_context.get("summary") or {}

        missing_pct = float(summary.get("missing_pct") or 0)
        imbalance_pct = float(summary.get("imbalance_pct") or 0)

        if missing_pct >= settings.AUTO_FIX_MISSING_THRESHOLD:
            recommendations.append(
                RecommendationItem(
                    code="missing_value_fix",
                    title="Missing Value Risk",
                    severity="high" if missing_pct >= 0.15 else "medium",
                    risk_score=min(100, max(40, int(missing_pct * 400))),
                    rationale="Null-heavy features can destabilize preprocessing and degrade downstream model quality.",
                    recommended_action="Impute missing values, normalize blank placeholders, and re-run quality checks before retraining.",
                    auto_fix_available=True,
                )
            )

        if imbalance_pct >= settings.AUTO_FIX_IMBALANCE_THRESHOLD:
            recommendations.append(
                RecommendationItem(
                    code="class_imbalance_oversample",
                    title="Class Imbalance Detected",
                    severity="high" if imbalance_pct >= 0.85 else "medium",
                    risk_score=min(100, max(45, int(imbalance_pct * 100))),
                    rationale="A dominant class or group can skew model behavior and suppress minority outcomes.",
                    recommended_action="Oversample minority classes or rebalance the training data before retraining the model.",
                    auto_fix_available=True,
                )
            )

        if quality_score is not None and quality_score < 85:
            recommendations.append(
                RecommendationItem(
                    code="quality_cleanup",
                    title="Dataset Quality Degradation",
                    severity="medium" if quality_score >= 70 else "high",
                    risk_score=100 - int(quality_score),
                    rationale="Missing values, duplicates, imbalance, or outliers are reducing training readiness.",
                    recommended_action="Apply preprocessing cleanup, remove invalid placeholders, and validate the dataset again before training.",
                    auto_fix_available=quality_score < 80,
                )
            )

    def _append_training_recommendations(self, recommendations: List[RecommendationItem], training_context: dict) -> None:
        overfitting_score = training_context.get("overfitting_score")
        train_accuracy = training_context.get("train_accuracy")
        validation_accuracy = training_context.get("validation_accuracy")

        if overfitting_score is None and train_accuracy is not None and validation_accuracy is not None:
            overfitting_score = round(float(train_accuracy) - float(validation_accuracy), 4)

        if overfitting_score is not None and float(overfitting_score) >= 0.08:
            recommendations.append(
                RecommendationItem(
                    code="overfitting_regularization",
                    title="Overfitting Risk",
                    severity="medium" if float(overfitting_score) < 0.15 else "high",
                    risk_score=min(100, max(40, int(float(overfitting_score) * 400))),
                    rationale="Training performance is materially stronger than held-out performance, suggesting weak generalization.",
                    recommended_action="Increase regularization, reduce model complexity, and validate performance on fresher holdout data.",
                    auto_fix_available=False,
                )
            )
