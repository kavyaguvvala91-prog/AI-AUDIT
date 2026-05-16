from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from ..models.schemas import GovernanceReportResponse, GovernanceSection, GovernanceSummary, RecommendationItem
from ..utils.config import settings


class GovernanceReportService:
    def build_report(
        self,
        summary: GovernanceSummary,
        findings: list[RecommendationItem],
        llm_text: str,
        monitoring_context: dict | None = None,
        quality_context: dict | None = None,
        training_context: dict | None = None,
    ) -> GovernanceReportResponse:
        monitoring_context = monitoring_context or {}
        quality_context = quality_context or {}
        training_context = training_context or {}

        actions = [item.recommended_action for item in findings]
        retrain_action = next(
            (item.recommended_action for item in findings if item.code == "drift_retrain"),
            "No retraining action required at this time.",
        )

        return GovernanceReportResponse(
            summary=summary,
            findings=findings,
            model_health=self._model_health_section(summary, quality_context, training_context),
            drift_summary=self._drift_section(monitoring_context.get("drift") or {}),
            fairness_summary=self._fairness_section(monitoring_context.get("bias") or {}),
            anomaly_summary=self._anomaly_section(monitoring_context.get("anomaly") or {}),
            confidence_analysis=self._confidence_section(monitoring_context.get("confidence_summary") or {}),
            recommended_actions=actions,
            retraining_recommendation=retrain_action,
            narrative=llm_text,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    def export_json(self, report: GovernanceReportResponse, output_path: str) -> str:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report.model_dump(), indent=2), encoding="utf-8")
        return str(path)

    def export_pdf(self, report: GovernanceReportResponse, output_path: str) -> str:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas

        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        pdf = canvas.Canvas(str(path), pagesize=A4)
        width, height = A4
        y = height - 50

        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(40, y, "AI Governance Report")
        y -= 28
        pdf.setFont("Helvetica", 11)
        pdf.drawString(40, y, f"Generated at: {report.generated_at}")
        y -= 20

        y = self._draw_section(
            pdf,
            y,
            "Model Health",
            [
                f"Health score: {report.summary.model_health_score}/100",
                f"Risk score: {report.summary.overall_risk_score}/100",
                f"Severity: {report.summary.severity}",
                report.model_health.summary,
            ],
            height,
        )
        y = self._draw_section(pdf, y, "Drift Summary", self._section_lines(report.drift_summary), height)
        y = self._draw_section(pdf, y, "Fairness Summary", self._section_lines(report.fairness_summary), height)
        y = self._draw_section(pdf, y, "Anomaly Summary", self._section_lines(report.anomaly_summary), height)
        y = self._draw_section(pdf, y, "Confidence Analysis", self._section_lines(report.confidence_analysis), height)
        y = self._draw_section(
            pdf,
            y,
            "Recommended Actions",
            [f"- {action}" for action in report.recommended_actions] or ["- No immediate action required."],
            height,
        )
        y = self._draw_section(pdf, y, "Retraining Recommendation", [report.retraining_recommendation], height)
        self._draw_section(pdf, y, "Narrative", self._wrap(report.narrative, 105), height)

        pdf.save()
        return str(path)

    def _model_health_section(self, summary: GovernanceSummary, quality_context: dict, training_context: dict) -> GovernanceSection:
        quality_score = quality_context.get("quality_score")
        metrics = {
            "model_health_score": summary.model_health_score,
            "overall_risk_score": summary.overall_risk_score,
        }
        if quality_score is not None:
            metrics["quality_score"] = quality_score
        if training_context.get("model_type"):
            metrics["model_type"] = training_context.get("model_type")
        return GovernanceSection(
            title="Model Health",
            status=summary.status,
            summary="Composite governance score across risk findings, model health, and training readiness.",
            metrics=metrics,
        )

    def _drift_section(self, drift: dict) -> GovernanceSection:
        drift_score = float(drift.get("drift_score") or 0)
        status = "alert" if drift_score >= settings.DRIFT_THRESHOLD else "stable"
        return GovernanceSection(
            title="Drift Summary",
            status=status,
            summary=(
                "Production data has moved beyond the accepted drift threshold."
                if status == "alert"
                else "Current production drift is within the managed range."
            ),
            metrics={
                "drift_score": drift_score,
                "drifted": drift.get("drifted", drift_score >= settings.DRIFT_THRESHOLD),
                "threshold": drift.get("threshold", settings.DRIFT_THRESHOLD),
                "top_columns": drift.get("column_drift", {}),
            },
        )

    def _fairness_section(self, bias: dict) -> GovernanceSection:
        detected = bool(bias.get("bias_detected"))
        return GovernanceSection(
            title="Fairness Summary",
            status="alert" if detected else "stable",
            summary=(
                "Fairness disparities were detected across protected or sensitive groups."
                if detected
                else "No material fairness disparities are currently flagged."
            ),
            metrics={
                "bias_detected": detected,
                "fairness_score": bias.get("fairness_score"),
                "bias_severity": bias.get("bias_severity"),
                "sensitive_attributes": bias.get("sensitive_attributes", []),
                "group_summary": bias.get("group_summary", {}),
            },
        )

    def _anomaly_section(self, anomaly: dict) -> GovernanceSection:
        anomaly_rate = float(anomaly.get("anomaly_rate") or 0)
        return GovernanceSection(
            title="Anomaly Summary",
            status="alert" if anomaly_rate > 0.1 else "watch" if anomaly_rate > 0.03 else "stable",
            summary=(
                "Incoming data contains a meaningful number of anomalous records."
                if anomaly_rate > 0.1
                else "Anomaly levels are currently manageable."
            ),
            metrics={
                "anomaly_rate": anomaly_rate,
                "total_anomalies": anomaly.get("total_anomalies", 0),
                "sample_indices": anomaly.get("anomaly_indices", [])[:10],
            },
        )

    def _confidence_section(self, confidence: dict) -> GovernanceSection:
        average_confidence = confidence.get("average_confidence")
        low_confidence_rate = confidence.get("low_confidence_rate")
        return GovernanceSection(
            title="Confidence Analysis",
            status="alert" if confidence.get("low_confidence_alert") else "stable",
            summary=(
                "Prediction confidence indicates elevated human-review pressure."
                if confidence.get("low_confidence_alert")
                else "Prediction confidence is within the expected operating range."
            ),
            metrics={
                "average_confidence": average_confidence,
                "min_confidence": confidence.get("min_confidence"),
                "max_confidence": confidence.get("max_confidence"),
                "low_confidence_count": confidence.get("low_confidence_count"),
                "low_confidence_rate": low_confidence_rate,
                "low_confidence_alert": confidence.get("low_confidence_alert", False),
            },
        )

    def _section_lines(self, section: GovernanceSection) -> list[str]:
        lines = [section.summary]
        for key, value in section.metrics.items():
            lines.append(f"{key}: {value}")
        return lines

    def _draw_section(self, pdf, y: int, title: str, lines: list[str], page_height: float) -> int:
        if y < 110:
            pdf.showPage()
            y = page_height - 50
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(40, y, title)
        y -= 18
        pdf.setFont("Helvetica", 10)
        for line in lines:
            for chunk in self._wrap(str(line), 105):
                if y < 80:
                    pdf.showPage()
                    y = page_height - 50
                    pdf.setFont("Helvetica", 10)
                pdf.drawString(40, y, chunk)
                y -= 14
        return y - 8

    def _wrap(self, text: str, width: int) -> list[str]:
        words = text.split()
        if not words:
            return [""]
        lines = []
        current = []
        current_len = 0
        for word in words:
            if current_len + len(word) + len(current) > width:
                lines.append(" ".join(current))
                current = [word]
                current_len = len(word)
            else:
                current.append(word)
                current_len += len(word)
        if current:
            lines.append(" ".join(current))
        return lines
