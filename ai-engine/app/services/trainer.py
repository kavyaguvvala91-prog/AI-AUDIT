"""
app/services/trainer.py
────────────────────────
ModelTrainer: AutoML pipeline that:
  1. Loads and preprocesses the dataset
  2. Detects problem type (classification vs regression)
  3. Selects and trains the best-fit sklearn model
  4. Evaluates on a held-out test set
  5. Saves the model + cleaner to disk with joblib
  6. Returns rich metrics including feature importances

Model selection logic:
  Classification  → tries LogisticRegression AND RandomForestClassifier,
                    picks the one with the higher F1 score.
  Regression      → tries LinearRegression AND RandomForestRegressor,
                    picks the one with the lower RMSE.
"""

import logging
import uuid
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.model_selection import train_test_split

from app.models.schemas import ModelMetrics, TrainResponse
from app.preprocessing.cleaner import DataCleaner
from app.services.analyzer import DatasetAnalyzer
from app.utils.config import settings
from app.utils.file_utils import load_csv

logger = logging.getLogger(__name__)

# Model catalogue — tried in order; best one wins
CLASSIFICATION_CANDIDATES = [
    ("LogisticRegression", LogisticRegression(max_iter=1000, random_state=settings.RANDOM_STATE)),
    ("RandomForestClassifier", RandomForestClassifier(n_estimators=100, random_state=settings.RANDOM_STATE)),
]

REGRESSION_CANDIDATES = [
    ("LinearRegression", LinearRegression()),
    ("RandomForestRegressor", RandomForestRegressor(n_estimators=100, random_state=settings.RANDOM_STATE)),
]


class ModelTrainer:

    def __init__(self):
        self.analyzer = DatasetAnalyzer()

    # ── Public entry point ────────────────────────────────────────────────────

    def train(
        self,
        file_path: str,
        target_column: str,
        config: Optional[Dict[str, Any]] = None,
    ) -> TrainResponse:
        cfg = config or {}
        test_size = float(cfg.get("test_size", settings.TEST_SIZE))
        random_state = int(cfg.get("random_state", settings.RANDOM_STATE))

        # ── 1. Load data ───────────────────────────────────────────────────
        df = load_csv(file_path)

        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found in dataset.")

        # ── 2. Detect problem type ────────────────────────────────────────
        problem_type = self.analyzer._problem_type(df, target_column)
        logger.info(f"Problem type: {problem_type} | Target: {target_column}")

        # ── 3. Preprocess ─────────────────────────────────────────────────
        cleaner = DataCleaner()
        X = cleaner.fit_transform(df, target_column)
        y_raw = df[target_column].fillna(df[target_column].mode()[0])
        y, target_encoder = cleaner.encode_target(y_raw)

        # ── 4. Train / test split ─────────────────────────────────────────
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state,
            stratify=y if problem_type == "classification" and len(np.unique(y)) > 1 else None,
        )

        # ── 5. AutoML — try candidates, keep best ─────────────────────────
        best_model, best_model_name, metrics = self._automl(
            problem_type, X_train, X_test, y_train, y_test, cleaner
        )

        # ── 6. Persist ────────────────────────────────────────────────────
        model_id = str(uuid.uuid4())
        model_path, prep_path = self._save(model_id, best_model, cleaner)

        logger.info(f"Model saved: {model_id} ({best_model_name})")

        return TrainResponse(
            model_id=model_id,
            target_column=target_column,
            metrics=ModelMetrics(
                model_type=best_model_name,
                problem_type=problem_type,
                train_samples=len(X_train),
                test_samples=len(X_test),
                feature_count=X_train.shape[1],
                **metrics,
            ),
            model_path=str(model_path),
            preprocessing_path=str(prep_path),
        )

    # ── AutoML selection ──────────────────────────────────────────────────────

    def _automl(
        self,
        problem_type: str,
        X_train, X_test, y_train, y_test,
        cleaner: DataCleaner,
    ) -> Tuple[Any, str, Dict]:
        candidates = (
            CLASSIFICATION_CANDIDATES if problem_type == "classification"
            else REGRESSION_CANDIDATES
        )

        best_score = None
        best_model = None
        best_name = ""
        best_metrics: Dict = {}

        for name, model in candidates:
            logger.info(f"Training candidate: {name}")
            try:
                model.fit(X_train, y_train)
                preds = model.predict(X_test)
                metrics, score = self._evaluate(
                    problem_type, y_test, preds, model, cleaner
                )
                logger.info(f"  {name} score: {score:.4f}")

                # Lower is better for regression (RMSE), higher for classification (F1)
                is_better = (
                    best_score is None
                    or (problem_type == "regression" and score < best_score)
                    or (problem_type == "classification" and score > best_score)
                )
                if is_better:
                    best_score = score
                    best_model = model
                    best_name = name
                    best_metrics = metrics
            except Exception as exc:
                logger.warning(f"  {name} failed: {exc}")
                continue

        if best_model is None:
            raise RuntimeError("All AutoML candidates failed to train.")

        logger.info(f"Best model: {best_name} (score={best_score:.4f})")
        return best_model, best_name, best_metrics

    # ── Evaluation ────────────────────────────────────────────────────────────

    def _evaluate(
        self,
        problem_type: str,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        model: Any,
        cleaner: DataCleaner,
    ) -> Tuple[Dict, float]:
        metrics: Dict = {}
        score: float

        if problem_type == "classification":
            avg = "binary" if len(np.unique(y_true)) == 2 else "weighted"
            metrics["accuracy"] = round(float(accuracy_score(y_true, y_pred)), 4)
            metrics["precision"] = round(float(precision_score(y_true, y_pred, average=avg, zero_division=0)), 4)
            metrics["recall"] = round(float(recall_score(y_true, y_pred, average=avg, zero_division=0)), 4)
            metrics["f1_score"] = round(float(f1_score(y_true, y_pred, average=avg, zero_division=0)), 4)
            score = metrics["f1_score"]
        else:
            rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
            metrics["rmse"] = round(rmse, 4)
            metrics["mae"] = round(float(mean_absolute_error(y_true, y_pred)), 4)
            metrics["r2"] = round(float(r2_score(y_true, y_pred)), 4)
            score = rmse  # lower = better

        # Feature importance (tree-based models only)
        if hasattr(model, "feature_importances_") and cleaner.feature_columns:
            importances = model.feature_importances_
            fi = dict(zip(cleaner.feature_columns, importances.tolist()))
            # Return top 20 sorted by importance
            metrics["feature_importance"] = dict(
                sorted(fi.items(), key=lambda x: x[1], reverse=True)[:20]
            )

        return metrics, score

    # ── Persistence ───────────────────────────────────────────────────────────

    def _save(
        self, model_id: str, model: Any, cleaner: DataCleaner
    ) -> Tuple[Path, Path]:
        model_dir = settings.MODEL_DIR / model_id
        model_dir.mkdir(parents=True, exist_ok=True)

        model_path = model_dir / "model.joblib"
        prep_path = model_dir / "preprocessor.joblib"

        joblib.dump(model, model_path)
        joblib.dump(cleaner, prep_path)

        return model_path, prep_path