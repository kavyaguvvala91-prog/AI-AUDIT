from typing import Dict, List, Optional

from ..models.schemas import MetricDelta, RetrainResponse
from .model_registry import read_metadata
from .trainer import ModelTrainer
from ..utils.config import settings


class RetrainingService:
    def __init__(self):
        self.trainer = ModelTrainer()

    def retrain_if_needed(
        self,
        file_path: str,
        target_column: str,
        current_model_id: Optional[str] = None,
        drift_score: Optional[float] = None,
        config: Optional[Dict] = None,
    ) -> RetrainResponse:
        threshold = settings.DRIFT_THRESHOLD
        current_metadata = read_metadata(current_model_id) if current_model_id else {}

        if drift_score is not None and drift_score < threshold:
            return RetrainResponse(
                triggered=False,
                reason="Drift score is below the retraining threshold.",
                drift_score=drift_score,
                threshold=threshold,
                previous_model_id=current_model_id,
                previous_version=current_metadata.get("version"),
            )

        next_version = self._next_version(current_metadata.get("version"))
        training_result = self.trainer.train(
            file_path=file_path,
            target_column=target_column,
            config={
                **(config or {}),
                "parent_model_id": current_model_id,
                "model_version": next_version,
            },
        )
        comparison = self._compare_metrics(current_metadata.get("metrics", {}), training_result.metrics.model_dump())

        return RetrainResponse(
            triggered=True,
            reason="Automatic retraining triggered by detected drift." if drift_score is not None else "Manual retraining requested.",
            drift_score=drift_score,
            threshold=threshold,
            previous_model_id=current_model_id,
            new_model_id=training_result.model_id,
            previous_version=current_metadata.get("version"),
            new_version=training_result.model_version,
            comparison=comparison,
            training_result=training_result,
        )

    def _next_version(self, version: Optional[str]) -> str:
        if not version or not version.startswith("v"):
            return "v1"
        try:
            return f"v{int(version[1:]) + 1}"
        except ValueError:
            return "v1"

    def _compare_metrics(self, previous: Dict, current: Dict) -> List[MetricDelta]:
        deltas: List[MetricDelta] = []
        for metric in ("accuracy", "precision", "recall", "f1_score", "rmse", "mae", "r2"):
            old_value = previous.get(metric)
            new_value = current.get(metric)
            if old_value is None and new_value is None:
                continue
            delta = None
            if old_value is not None and new_value is not None:
                delta = round(float(new_value) - float(old_value), 4)
            deltas.append(
                MetricDelta(
                    metric=metric,
                    old_value=old_value,
                    new_value=new_value,
                    delta=delta,
                )
            )
        return deltas
