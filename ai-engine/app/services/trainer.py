import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    recall_score,
    r2_score,
)
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from ..models.schemas import ModelCandidateResult, ModelMetrics, TrainResponse
from ..preprocessing.cleaner import DataCleaner
from .analyzer import DatasetAnalyzer
from .model_registry import save_artifacts
from ..utils.config import settings
from ..utils.file_utils import load_csv

logger = logging.getLogger(__name__)

try:
    from xgboost import XGBClassifier, XGBRegressor
except Exception:  # pragma: no cover - optional dependency
    XGBClassifier = None
    XGBRegressor = None


class ModelTrainer:
    def __init__(self):
        self.analyzer = DatasetAnalyzer()

    def train(
        self,
        file_path: str,
        target_column: str,
        config: Optional[Dict[str, Any]] = None,
    ) -> TrainResponse:
        cfg = config or {}
        test_size = float(cfg.get("test_size", settings.TEST_SIZE))
        random_state = int(cfg.get("random_state", settings.RANDOM_STATE))
        requested_model = cfg.get("model_type")
        parent_model_id = cfg.get("parent_model_id")
        model_version = cfg.get("model_version")

        df = load_csv(file_path)
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found in dataset.")

        problem_type = self.analyzer._problem_type(df, target_column)
        cleaner = DataCleaner()
        X = cleaner.fit_transform(df, target_column)
        y_raw = df[target_column].fillna(df[target_column].mode()[0])
        y, _ = cleaner.encode_target(y_raw)

        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=test_size,
            random_state=random_state,
            stratify=y if problem_type == "classification" and len(np.unique(y)) > 1 else None,
        )

        started = time.perf_counter()
        best_model, best_name, best_metrics, leaderboard = self._automl(
            problem_type=problem_type,
            X_train=X_train,
            X_test=X_test,
            y_train=y_train,
            y_test=y_test,
            cleaner=cleaner,
            requested_model=requested_model,
        )
        training_time_s = round(time.perf_counter() - started, 4)

        model_id = str(uuid.uuid4())
        version = model_version or f"v{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

        metadata = {
            "model_id": model_id,
            "version": version,
            "parent_model_id": parent_model_id,
            "target_column": target_column,
            "problem_type": problem_type,
            "model_type": best_name,
            "leaderboard": [candidate.model_dump() for candidate in leaderboard],
            "metrics": best_metrics,
            "feature_columns": cleaner.feature_columns,
            "training_time_s": training_time_s,
        }
        artifacts = save_artifacts(model_id, best_model, cleaner, metadata)

        response_metrics = ModelMetrics(
            model_type=best_name,
            problem_type=problem_type,
            train_samples=len(X_train),
            test_samples=len(X_test),
            feature_count=X_train.shape[1],
            training_time_s=training_time_s,
            leaderboard=leaderboard,
            **best_metrics,
        )

        return TrainResponse(
            model_id=model_id,
            target_column=target_column,
            model_version=version,
            parent_model_id=parent_model_id,
            metrics=response_metrics,
            model_path=artifacts["model_path"],
            preprocessing_path=artifacts["preprocessing_path"],
            metadata_path=artifacts["metadata_path"],
        )

    def _automl(
        self,
        problem_type: str,
        X_train,
        X_test,
        y_train,
        y_test,
        cleaner: DataCleaner,
        requested_model: Optional[str] = None,
    ) -> Tuple[Any, str, Dict[str, Any], List[ModelCandidateResult]]:
        candidates = self._build_candidates(problem_type)
        if requested_model:
            candidates = [item for item in candidates if item[0].lower() == requested_model.lower()]
            if not candidates:
                raise ValueError(f"Requested model_type '{requested_model}' is not supported.")

        best_score = None
        best_model = None
        best_name = ""
        best_metrics: Dict[str, Any] = {}
        leaderboard: List[ModelCandidateResult] = []

        for name, model in candidates:
            logger.info("Training candidate: %s", name)
            started = time.perf_counter()
            try:
                model.fit(X_train, y_train)
                preds = model.predict(X_test)
                train_preds = model.predict(X_train)
                metrics, score = self._evaluate(problem_type, y_train, train_preds, y_test, preds, model, cleaner)
                elapsed = round(time.perf_counter() - started, 4)
                leaderboard.append(
                    ModelCandidateResult(
                        model_type=name,
                        ranking_score=round(float(score), 4),
                        selection_metric="f1_score" if problem_type == "classification" else "rmse",
                        metrics=metrics,
                        training_time_s=elapsed,
                    )
                )

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
                logger.warning("Candidate %s failed: %s", name, exc)

        if best_model is None:
            raise RuntimeError("All AutoML candidates failed to train.")

        leaderboard.sort(
            key=lambda item: item.ranking_score,
            reverse=problem_type == "classification",
        )
        return best_model, best_name, best_metrics, leaderboard

    def _build_candidates(self, problem_type: str):
        if problem_type == "classification":
            candidates = [
                ("LogisticRegression", LogisticRegression(max_iter=1000, random_state=settings.RANDOM_STATE)),
                ("RandomForestClassifier", RandomForestClassifier(n_estimators=120, random_state=settings.RANDOM_STATE)),
                ("DecisionTreeClassifier", DecisionTreeClassifier(random_state=settings.RANDOM_STATE)),
            ]
            if XGBClassifier is not None:
                candidates.append(
                    (
                        "XGBoostClassifier",
                        XGBClassifier(
                            n_estimators=120,
                            max_depth=6,
                            learning_rate=0.08,
                            subsample=0.9,
                            colsample_bytree=0.9,
                            random_state=settings.RANDOM_STATE,
                            eval_metric="logloss",
                        ),
                    )
                )
            return candidates

        candidates = [
            ("LinearRegression", LinearRegression()),
            ("RandomForestRegressor", RandomForestRegressor(n_estimators=120, random_state=settings.RANDOM_STATE)),
            ("DecisionTreeRegressor", DecisionTreeRegressor(random_state=settings.RANDOM_STATE)),
        ]
        if XGBRegressor is not None:
            candidates.append(
                (
                    "XGBoostRegressor",
                    XGBRegressor(
                        n_estimators=120,
                        max_depth=6,
                        learning_rate=0.08,
                        subsample=0.9,
                        colsample_bytree=0.9,
                        random_state=settings.RANDOM_STATE,
                    ),
                )
            )
        return candidates

    def _evaluate(
        self,
        problem_type: str,
        y_train_true: np.ndarray,
        y_train_pred: np.ndarray,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        model: Any,
        cleaner: DataCleaner,
    ) -> Tuple[Dict[str, Any], float]:
        metrics: Dict[str, Any] = {}

        if problem_type == "classification":
            average = "binary" if len(np.unique(y_true)) == 2 else "weighted"
            metrics["train_accuracy"] = round(float(accuracy_score(y_train_true, y_train_pred)), 4)
            metrics["accuracy"] = round(float(accuracy_score(y_true, y_pred)), 4)
            metrics["precision"] = round(float(precision_score(y_true, y_pred, average=average, zero_division=0)), 4)
            metrics["recall"] = round(float(recall_score(y_true, y_pred, average=average, zero_division=0)), 4)
            metrics["f1_score"] = round(float(f1_score(y_true, y_pred, average=average, zero_division=0)), 4)
            score = metrics["f1_score"]
        else:
            train_rmse = float(np.sqrt(mean_squared_error(y_train_true, y_train_pred)))
            metrics["train_rmse"] = round(train_rmse, 4)
            rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
            metrics["rmse"] = round(rmse, 4)
            metrics["mae"] = round(float(mean_absolute_error(y_true, y_pred)), 4)
            metrics["r2"] = round(float(r2_score(y_true, y_pred)), 4)
            score = rmse

        if hasattr(model, "feature_importances_") and cleaner.feature_columns:
            importances = model.feature_importances_
            feature_importance = dict(zip(cleaner.feature_columns, importances.tolist()))
            metrics["feature_importance"] = {
                key: round(float(value), 4)
                for key, value in sorted(feature_importance.items(), key=lambda item: item[1], reverse=True)[:20]
            }
        elif hasattr(model, "coef_") and cleaner.feature_columns:
            coefficients = np.ravel(model.coef_)
            coef_map = dict(zip(cleaner.feature_columns, np.abs(coefficients).tolist()))
            metrics["feature_importance"] = {
                key: round(float(value), 4)
                for key, value in sorted(coef_map.items(), key=lambda item: item[1], reverse=True)[:20]
            }

        return metrics, score
