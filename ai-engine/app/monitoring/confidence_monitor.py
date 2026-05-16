"""
app/monitoring/confidence_monitor.py
────────────────────────────────────
ConfidenceMonitor: lightweight confidence analytics for prediction outputs.

This module focuses on classification confidence:
  • average / min / max confidence
  • low-confidence row counts
  • low-confidence rate
  • threshold-based alerting

For regression models, confidence is not directly available from the current
sklearn models, so the monitor returns a small explanatory summary instead.
"""

from typing import Any, Dict, List

from app.models.schemas import PredictResponse

LOW_CONFIDENCE_THRESHOLD = 0.60
LOW_CONFIDENCE_RATE_ALERT = 0.20


class ConfidenceMonitor:
    """
    Computes dashboard-friendly confidence metrics from prediction outputs.
    """

    def summarize_predictions(
        self,
        prediction_result: PredictResponse,
        threshold: float = LOW_CONFIDENCE_THRESHOLD,
    ) -> Dict[str, Any]:
        """
        Summarize confidence scores from a PredictResponse object.
        """
        if prediction_result.problem_type != "classification":
            return {
                "problem_type": prediction_result.problem_type,
                "average_confidence": None,
                "min_confidence": None,
                "max_confidence": None,
                "low_confidence_count": 0,
                "low_confidence_rate": 0.0,
                "threshold": threshold,
                "low_confidence_alert": False,
                "message": "Confidence scores are only available for classification models.",
            }

        confidence_scores: List[float] = [
            float(row.confidence)
            for row in prediction_result.predictions
            if row.confidence is not None
        ]

        if not confidence_scores:
            return {
                "problem_type": prediction_result.problem_type,
                "average_confidence": None,
                "min_confidence": None,
                "max_confidence": None,
                "low_confidence_count": 0,
                "low_confidence_rate": 0.0,
                "threshold": threshold,
                "low_confidence_alert": False,
                "message": "Model predictions do not expose probability scores.",
            }

        low_confidence_count = sum(score < threshold for score in confidence_scores)
        low_confidence_rate = low_confidence_count / len(confidence_scores)

        return {
            "problem_type": prediction_result.problem_type,
            "average_confidence": round(sum(confidence_scores) / len(confidence_scores), 4),
            "min_confidence": round(min(confidence_scores), 4),
            "max_confidence": round(max(confidence_scores), 4),
            "low_confidence_count": int(low_confidence_count),
            "low_confidence_rate": round(low_confidence_rate, 4),
            "threshold": round(float(threshold), 4),
            "low_confidence_alert": low_confidence_rate >= LOW_CONFIDENCE_RATE_ALERT,
        }
