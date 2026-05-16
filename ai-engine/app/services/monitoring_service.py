"""
app/services/monitoring_service.py
──────────────────────────────────
MonitoringService: central aggregation layer for all monitoring modules.

This service combines:
  • drift detection
  • anomaly detection
  • bias auditing
  • confidence monitoring
  • feature-importance extraction

The route layer stays thin and delegates all orchestration to this service.
"""

import logging
from typing import Any, Dict, List, Optional

from ..models.schemas import MonitorResult
from ..monitoring.anomaly_detector import AnomalyDetector
from ..monitoring.bias_detector import BiasDetector
from ..monitoring.confidence_monitor import ConfidenceMonitor
from ..monitoring.drift_detector import DriftDetector
from .model_registry import load_artifacts
from .predictor import PredictionService

logger = logging.getLogger(__name__)


class MonitoringService:
    """
    Aggregates independent monitoring checks into one response payload.
    """

    def __init__(self):
        self.drift_detector = DriftDetector()
        self.bias_detector = BiasDetector()
        self.anomaly_detector = AnomalyDetector()
        self.confidence_monitor = ConfidenceMonitor()
        self.predictor = PredictionService()

    def monitor(
        self,
        dataset_id: str,
        current_file_path: str,
        reference_file_path: Optional[str] = None,
        model_id: Optional[str] = None,
        target_column: Optional[str] = None,
        sensitive_attributes: Optional[List[str]] = None,
        columns: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Run all requested monitoring checks and return one structured payload.
        """
        sensitive_attributes = sensitive_attributes or []

        drift_result = None
        if reference_file_path:
            drift_result = self.drift_detector.detect(
                current_file=current_file_path,
                reference_file=reference_file_path,
            )

        anomaly_result = self.anomaly_detector.detect(
            file_path=current_file_path,
            columns=columns,
        )

        bias_result = None
        if target_column and sensitive_attributes:
            bias_result = self.bias_detector.audit(
                file_path=current_file_path,
                target_column=target_column,
                sensitive_attributes=sensitive_attributes,
            )

        confidence_summary = None
        if model_id:
            prediction_result = self.predictor.predict(
                file_path=current_file_path,
                model_id=model_id,
            )
            confidence_summary = self.confidence_monitor.summarize_predictions(prediction_result)

        monitor_result = MonitorResult(
            dataset_id=dataset_id,
            drift=drift_result,
            bias=bias_result,
            anomaly=anomaly_result,
            confidence_summary=confidence_summary,
        )

        payload = monitor_result.model_dump()
        payload["feature_importance"] = self._feature_importance(model_id)
        payload["alerts"] = self._alerts(payload)
        return payload

    def _feature_importance(self, model_id: Optional[str]) -> Dict[str, float]:
        """
        Extract top feature importances for tree-based models if available.
        """
        if not model_id:
            return {}
        model, cleaner, _metadata = load_artifacts(model_id)

        if not hasattr(model, "feature_importances_"):
            return {}

        feature_names = getattr(cleaner, "feature_columns", [])
        importances = getattr(model, "feature_importances_", [])

        if not feature_names or len(feature_names) != len(importances):
            return {}

        ranked = dict(
            sorted(
                zip(feature_names, importances.tolist()),
                key=lambda item: item[1],
                reverse=True,
            )[:20]
        )
        return {key: round(float(value), 4) for key, value in ranked.items()}

    def _alerts(self, payload: Dict[str, Any]) -> List[str]:
        """
        Build simple dashboard alerts from computed monitoring signals.
        """
        alerts: List[str] = []

        drift = payload.get("drift")
        if drift and drift.get("drifted"):
            alerts.append(
                f"Data drift detected (score={drift['drift_score']}, threshold={drift['threshold']})."
            )

        anomaly = payload.get("anomaly")
        if anomaly and anomaly.get("anomaly_rate", 0) > 0.10:
            alerts.append(
                f"High anomaly rate detected ({anomaly['anomaly_rate']:.2%} of rows flagged)."
            )

        bias = payload.get("bias")
        if bias and bias.get("bias_detected"):
            alerts.append("Potential bias detected across the selected sensitive attributes.")

        confidence = payload.get("confidence_summary")
        if confidence and confidence.get("low_confidence_alert"):
            alerts.append(
                f"Low-confidence predictions detected ({confidence['low_confidence_count']} rows below threshold)."
            )

        return alerts
