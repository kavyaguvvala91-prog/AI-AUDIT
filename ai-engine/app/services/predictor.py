"""
app/services/predictor.py
──────────────────────────
PredictionService: loads a saved model + preprocessor from disk and runs
inference on a CSV file.

Returns per-row predictions including:
  • prediction value (decoded label for classification)
  • confidence score (max class probability for classification; None for regression)
  • full class probability dictionary (classification only)
  • summary statistics across all predictions
"""

import logging
from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd

from app.models.schemas import PredictResponse, PredictionRow
from app.utils.config import settings
from app.utils.file_utils import load_csv

logger = logging.getLogger(__name__)


class PredictionService:

    def predict(self, file_path: str, model_id: str) -> PredictResponse:
        # ── 1. Load model + preprocessor ──────────────────────────────────
        model_dir = settings.MODEL_DIR / model_id
        model_path = model_dir / "model.joblib"
        prep_path = model_dir / "preprocessor.joblib"

        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_id}. Train a model first.")

        model = joblib.load(model_path)
        cleaner = joblib.load(prep_path)

        logger.info(f"Loaded model {model_id} ({type(model).__name__})")

        # ── 2. Load and preprocess data ────────────────────────────────────
        df = load_csv(file_path)
        X = cleaner.transform(df)

        # ── 3. Detect problem type from model class name ───────────────────
        model_name = type(model).__name__.lower()
        is_classifier = any(
            kw in model_name for kw in ("classifier", "logistic")
        )

        # ── 4. Run inference ───────────────────────────────────────────────
        raw_preds = model.predict(X)
        probas = None
        if is_classifier and hasattr(model, "predict_proba"):
            probas = model.predict_proba(X)

        # Decode predictions if a target encoder was saved
        decoded_preds = cleaner.decode_target(raw_preds)
        class_labels = None
        if is_classifier:
            le = cleaner.label_encoders.get("__target__")
            class_labels = [str(c) for c in le.classes_] if le else None

        # ── 5. Build per-row results ───────────────────────────────────────
        rows: List[PredictionRow] = []
        for i in range(len(decoded_preds)):
            pred_val = (
                str(decoded_preds[i])
                if is_classifier
                else round(float(decoded_preds[i]), 4)
            )
            confidence = None
            prob_dict = None

            if probas is not None:
                row_probas = probas[i]
                confidence = round(float(np.max(row_probas)), 4)
                if class_labels:
                    prob_dict = {
                        lbl: round(float(p), 4)
                        for lbl, p in zip(class_labels, row_probas)
                    }

            rows.append(
                PredictionRow(
                    row_index=i,
                    prediction=pred_val,
                    confidence=confidence,
                    probabilities=prob_dict,
                )
            )

        # ── 6. Summary ─────────────────────────────────────────────────────
        summary = self._summary(decoded_preds, is_classifier)

        return PredictResponse(
            model_id=model_id,
            problem_type="classification" if is_classifier else "regression",
            total_rows=len(rows),
            predictions=rows,
            summary=summary,
        )

    # ── Summary helpers ───────────────────────────────────────────────────────

    def _summary(self, preds: np.ndarray, is_classifier: bool) -> Dict[str, Any]:
        if is_classifier:
            unique, counts = np.unique(preds, return_counts=True)
            return {
                "value_counts": {str(k): int(v) for k, v in zip(unique, counts)},
                "total": len(preds),
            }
        else:
            preds_f = preds.astype(float)
            return {
                "mean": round(float(np.mean(preds_f)), 4),
                "std": round(float(np.std(preds_f)), 4),
                "min": round(float(np.min(preds_f)), 4),
                "max": round(float(np.max(preds_f)), 4),
                "total": len(preds_f),
            }