import logging
from typing import Any, Dict, List

import numpy as np

from ..models.schemas import PredictResponse, PredictionRow
from .model_registry import load_artifacts
from ..utils.file_utils import load_csv

logger = logging.getLogger(__name__)


class PredictionService:
    def predict(self, file_path: str, model_id: str) -> PredictResponse:
        model, cleaner, _metadata = load_artifacts(model_id)
        df = load_csv(file_path)
        X = cleaner.transform(df)

        model_name = type(model).__name__.lower()
        is_classifier = any(keyword in model_name for keyword in ("classifier", "logistic"))

        raw_preds = model.predict(X)
        probabilities = model.predict_proba(X) if is_classifier and hasattr(model, "predict_proba") else None
        decoded_preds = cleaner.decode_target(raw_preds)

        class_labels = None
        if is_classifier:
            encoder = cleaner.label_encoders.get("__target__")
            class_labels = [str(value) for value in encoder.classes_] if encoder else None

        rows: List[PredictionRow] = []
        for index, prediction in enumerate(decoded_preds):
            confidence = None
            probability_map = None
            if probabilities is not None:
                row_probs = probabilities[index]
                confidence = round(float(np.max(row_probs)), 4)
                if class_labels:
                    probability_map = {
                        label: round(float(probability), 4)
                        for label, probability in zip(class_labels, row_probs)
                    }

            rows.append(
                PredictionRow(
                    row_index=index,
                    prediction=str(prediction) if is_classifier else round(float(prediction), 4),
                    confidence=confidence,
                    probabilities=probability_map,
                )
            )

        return PredictResponse(
            model_id=model_id,
            problem_type="classification" if is_classifier else "regression",
            total_rows=len(rows),
            predictions=rows,
            summary=self._summary(decoded_preds, is_classifier),
        )

    def _summary(self, predictions: np.ndarray, is_classifier: bool) -> Dict[str, Any]:
        if is_classifier:
            unique, counts = np.unique(predictions, return_counts=True)
            return {
                "value_counts": {str(label): int(count) for label, count in zip(unique, counts)},
                "total": len(predictions),
            }

        predictions = predictions.astype(float)
        return {
            "mean": round(float(np.mean(predictions)), 4),
            "std": round(float(np.std(predictions)), 4),
            "min": round(float(np.min(predictions)), 4),
            "max": round(float(np.max(predictions)), 4),
            "total": len(predictions),
        }
