from typing import Any, Dict, List

import numpy as np

from ..models.schemas import ExplainResponse, FeatureContribution
from .model_registry import load_artifacts
from ..utils.file_utils import load_csv

try:
    import shap
except Exception:  # pragma: no cover - optional dependency
    shap = None

try:
    from lime.lime_tabular import LimeTabularExplainer
except Exception:  # pragma: no cover - optional dependency
    LimeTabularExplainer = None


class ExplainabilityService:
    def explain(self, file_path: str, model_id: str, row_index: int = 0, top_n: int = 5) -> ExplainResponse:
        model, cleaner, metadata = load_artifacts(model_id)
        df = load_csv(file_path)
        if row_index < 0 or row_index >= len(df):
            raise ValueError(f"row_index {row_index} is out of range for {len(df)} rows.")

        transformed = cleaner.transform(df)
        row = transformed[row_index]
        raw_row = df.iloc[row_index].to_dict()
        feature_names = list(getattr(cleaner, "feature_columns", []))

        prediction, confidence_score = self._prediction_details(model, cleaner, row)
        shap_local, shap_global = self._shap_explanations(model, transformed, row, feature_names, raw_row, top_n)
        lime_local = self._lime_explanation(model, transformed, row, feature_names, raw_row, top_n)

        local = shap_local or lime_local or self._fallback_local(model, row, feature_names, raw_row, top_n)
        global_items = shap_global or self._fallback_global(model, feature_names, top_n)
        methods = []
        if shap_local or shap_global:
            methods.append("shap")
        if lime_local:
            methods.append("lime")
        if not methods:
            methods.append("fallback")

        reasoning = [
            f"{item.feature} pushed the prediction {item.direction} by {abs(item.contribution):.3f}"
            for item in local[:top_n]
        ]

        return ExplainResponse(
            model_id=model_id,
            model_type=metadata.get("model_type", type(model).__name__),
            problem_type=metadata.get("problem_type", "unknown"),
            confidence_score=confidence_score,
            prediction=prediction,
            top_features=global_items[:top_n],
            local_explanation=local,
            global_explanation=global_items,
            reasoning=reasoning,
            explanation_methods=methods,
        )

    def _prediction_details(self, model, cleaner, row) -> tuple[Any, float | None]:
        prediction_raw = model.predict(np.array([row]))[0]
        prediction = cleaner.decode_target(np.array([prediction_raw]))[0]
        confidence = None
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(np.array([row]))[0]
            confidence = round(float(np.max(probs)), 4)
        elif hasattr(model, "decision_function"):
            score = float(np.ravel(model.decision_function(np.array([row])))[0])
            confidence = round(float(1 / (1 + np.exp(-abs(score)))), 4)
        return prediction, confidence

    def _shap_explanations(self, model, transformed, row, feature_names, raw_row, top_n):
        if shap is None or not feature_names:
            return [], []
        try:
            sample = transformed[: min(len(transformed), 200)]
            explainer = shap.Explainer(model, sample)
            shap_values = explainer(sample)
            row_values = explainer(np.array([row]))

            local_values = np.ravel(row_values.values[0])
            global_values = np.mean(np.abs(shap_values.values), axis=0)
            return (
                self._to_contributions(local_values, feature_names, raw_row, top_n),
                self._to_contributions(global_values, feature_names, raw_row, top_n, absolute=True),
            )
        except Exception:
            return [], []

    def _lime_explanation(self, model, transformed, row, feature_names, raw_row, top_n):
        if LimeTabularExplainer is None or not feature_names:
            return []
        try:
            explainer = LimeTabularExplainer(
                transformed[: min(len(transformed), 300)],
                feature_names=feature_names,
                discretize_continuous=True,
                mode="classification" if hasattr(model, "predict_proba") else "regression",
            )
            predict_fn = model.predict_proba if hasattr(model, "predict_proba") else model.predict
            explanation = explainer.explain_instance(row, predict_fn, num_features=top_n)
            items = []
            for feature_text, score in explanation.as_list():
                items.append(
                    FeatureContribution(
                        feature=feature_text,
                        contribution=round(float(score), 4),
                        value=None,
                        direction="up" if score >= 0 else "down",
                    )
                )
            return items
        except Exception:
            return []

    def _fallback_local(self, model, row, feature_names, raw_row, top_n):
        if hasattr(model, "coef_"):
            coefs = np.ravel(model.coef_)
            scores = row * coefs[: len(row)]
            return self._to_contributions(scores, feature_names, raw_row, top_n)
        if hasattr(model, "feature_importances_"):
            return self._to_contributions(model.feature_importances_, feature_names, raw_row, top_n, absolute=True)
        return []

    def _fallback_global(self, model, feature_names, top_n):
        raw_row = {}
        if hasattr(model, "feature_importances_"):
            return self._to_contributions(model.feature_importances_, feature_names, raw_row, top_n, absolute=True)
        if hasattr(model, "coef_"):
            return self._to_contributions(np.abs(np.ravel(model.coef_)), feature_names, raw_row, top_n, absolute=True)
        return []

    def _to_contributions(self, values, feature_names, raw_row: Dict[str, Any], top_n: int, absolute: bool = False) -> List[FeatureContribution]:
        pairs = []
        for index, feature in enumerate(feature_names[: len(values)]):
            contribution = float(values[index])
            ranking_value = abs(contribution) if absolute else abs(contribution)
            pairs.append((feature, contribution, ranking_value))
        pairs.sort(key=lambda item: item[2], reverse=True)
        results = []
        for feature, contribution, _ in pairs[:top_n]:
            results.append(
                FeatureContribution(
                    feature=feature,
                    contribution=round(contribution, 4),
                    value=raw_row.get(feature),
                    direction="up" if contribution >= 0 else "down",
                )
            )
        return results
