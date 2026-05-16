from __future__ import annotations

import json
from typing import Optional
from urllib.parse import urlencode
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .prompt_templates import governance_prompt, remediation_prompt
from ..utils.config import settings


class LLMRouter:
    def generate(self, context: dict, preferred_provider: Optional[str] = None, mode: str = "remediation") -> dict:
        prompt = remediation_prompt(context) if mode == "remediation" else governance_prompt(context)
        providers = self._ordered_providers(preferred_provider)

        for provider in providers:
            try:
                if provider == "openai":
                    result = self._openai(prompt)
                    model = settings.OPENAI_MODEL
                else:
                    result = self._gemini(prompt)
                    model = settings.GEMINI_MODEL
                if result:
                    return {"provider": provider, "model": model, "text": result}
            except (HTTPError, URLError, TimeoutError, ValueError, KeyError):
                continue

        return {
            "provider": "rule-based",
            "model": "local-fallback",
            "text": self._fallback(context, mode),
        }

    def _ordered_providers(self, preferred_provider: Optional[str]) -> list[str]:
        if preferred_provider == "openai":
            return ["openai", "gemini"]
        if preferred_provider == "gemini":
            return ["gemini", "openai"]
        return ["openai", "gemini"]

    def _openai(self, prompt: str) -> Optional[str]:
        if not settings.OPENAI_API_KEY:
            return None
        payload = {
            "model": settings.OPENAI_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an enterprise AI governance analyst. "
                        "Explain drift, fairness, confidence, anomalies, and remediation priorities clearly. "
                        "Use concise business language and avoid generic filler."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": settings.LLM_MAX_TOKENS,
        }
        data = self._post_json(
            "https://api.openai.com/v1/chat/completions",
            payload,
            headers={
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
        )
        return data["choices"][0]["message"]["content"].strip()

    def _gemini(self, prompt: str) -> Optional[str]:
        if not settings.GEMINI_API_KEY:
            return None
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": settings.LLM_MAX_TOKENS,
            },
        }
        data = self._post_json(
            (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{settings.GEMINI_MODEL}:generateContent?{urlencode({'key': settings.GEMINI_API_KEY})}"
            ),
            payload,
            headers={"Content-Type": "application/json"},
        )
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        text = "\n".join(part.get("text", "") for part in parts).strip()
        return text or None

    def _post_json(self, url: str, payload: dict, headers: dict) -> dict:
        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urlopen(request, timeout=settings.LLM_TIMEOUT) as response:
            body = response.read().decode("utf-8")
        return json.loads(body)

    def _best_bias_gap(self, bias_summary: dict) -> Optional[tuple[str, str, str, float, float]]:
        best: Optional[tuple[str, str, str, float, float]] = None
        for attribute, groups in (bias_summary or {}).items():
            valid_groups = [
                group for group in groups
                if isinstance(group, dict) and isinstance(group.get("positive_rate"), (int, float))
            ]
            if len(valid_groups) < 2:
                continue
            lowest = min(valid_groups, key=lambda item: item["positive_rate"])
            highest = max(valid_groups, key=lambda item: item["positive_rate"])
            gap = float(highest["positive_rate"]) - float(lowest["positive_rate"])
            if best is None or gap > best[3]:
                best = (
                    str(attribute),
                    str(lowest.get("group")),
                    str(highest.get("group")),
                    gap,
                    float(lowest["positive_rate"]),
                )
        return best

    def _top_feature(self, feature_map: dict) -> Optional[tuple[str, float]]:
        ranked = [
            (str(name), float(score))
            for name, score in (feature_map or {}).items()
            if isinstance(score, (int, float))
        ]
        if not ranked:
            return None
        return max(ranked, key=lambda item: item[1])

    def _humanize(self, value: str) -> str:
        return str(value).replace("_", " ").strip()

    def _fallback(self, context: dict, mode: str) -> str:
        monitoring = context.get("monitoring_context", {})
        quality = context.get("quality_context", {})
        training = context.get("training_context", {})

        drift_payload = monitoring.get("drift") or {}
        bias_payload = monitoring.get("bias") or {}
        anomaly_payload = monitoring.get("anomaly") or {}
        confidence_payload = monitoring.get("confidence_summary") or {}
        drift = drift_payload.get("drift_score")
        bias = bias_payload.get("bias_detected")
        anomaly_rate = anomaly_payload.get("anomaly_rate")
        confidence = confidence_payload.get("average_confidence")
        quality_score = quality.get("quality_score")
        overfitting_score = training.get("overfitting_score")

        lines = []
        bias_gap = self._best_bias_gap(bias_payload.get("group_summary") or {})
        if bias_gap:
            attribute, lowest_group, highest_group, gap, lowest_rate = bias_gap
            lines.append(
                f"{lowest_group} applicants show lower approval rates on {self._humanize(attribute)} with a parity gap of {gap:.2f} and a positive rate of {lowest_rate:.2f}."
            )

        top_drift = self._top_feature(drift_payload.get("column_drift") or {})
        if top_drift:
            feature_name, feature_score = top_drift
            lines.append(
                f"{self._humanize(feature_name)} shows the largest shift from training data with a drift score of {feature_score:.2f}."
            )

        top_importance = self._top_feature(training.get("feature_importance") or {})
        if top_importance:
            feature_name, feature_score = top_importance
            lines.append(
                f"{self._humanize(feature_name)} is currently the strongest driver of model decisions with importance {feature_score:.2f}."
            )

        if drift is not None:
            lines.append(
                f"Drift score is {drift}, which suggests {'material feature shift' if drift >= settings.DRIFT_THRESHOLD else 'manageable movement'} between training and production data."
            )
        if bias is not None:
            lines.append(
                "Bias was detected across sensitive groups and fairness mitigation should be reviewed."
                if bias
                else "No material fairness issue is currently flagged."
            )
        if anomaly_rate is not None:
            lines.append(f"Anomaly rate is {anomaly_rate}, indicating the share of out-of-pattern records entering the model.")
        if confidence is not None:
            lines.append(f"Average prediction confidence is {confidence}, which helps estimate review pressure on human operators.")
        if quality_score is not None:
            lines.append(f"Dataset quality is {quality_score}/100, so preprocessing readiness should be considered before retraining.")
        if overfitting_score is not None:
            lines.append(f"Overfitting score is {overfitting_score}, so regularization and validation controls should be reviewed.")
        if mode == "governance":
            lines.append(
                "Recommended governance action: retrain on more balanced applicant data, review the most drifted segments, and keep human review on low-confidence approvals."
            )
        else:
            lines.append(
                "Recommended remediation: rebalance sensitive groups, refresh the training baseline, and retrain only after validating fairness and confidence improvements."
            )
        return " ".join(lines)
