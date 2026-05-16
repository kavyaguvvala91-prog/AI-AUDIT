from __future__ import annotations

from ..models.schemas import GovernanceSummary, RemediationResponse
from .ai_insight_service import AIInsightService
from .governance_report_service import GovernanceReportService
from .recommendation_engine import RecommendationEngine


class RemediationService:
    def __init__(self):
        self.recommendations = RecommendationEngine()
        self.insights = AIInsightService()
        self.reports = GovernanceReportService()

    def assess(
        self,
        monitoring_context: dict,
        quality_context: dict | None = None,
        explanation_context: dict | None = None,
        training_context: dict | None = None,
        preferred_provider: str | None = None,
    ) -> RemediationResponse:
        findings = self.recommendations.generate(monitoring_context, quality_context or {}, training_context or {})
        risk_score = min(100, max([item.risk_score for item in findings], default=15))
        model_health = max(0, 100 - risk_score)
        severity = "high" if risk_score >= 75 else "medium" if risk_score >= 40 else "low"
        summary = GovernanceSummary(
            model_health_score=model_health,
            overall_risk_score=risk_score,
            severity=severity,
            status="action_required" if findings else "healthy",
        )
        llm = self.insights.remediation_summary(
            {
                "monitoring_context": monitoring_context,
                "quality_context": quality_context or {},
                "explanation_context": explanation_context or {},
                "training_context": training_context or {},
                "findings": [item.model_dump() for item in findings],
            },
            preferred_provider=preferred_provider,
        )
        report = self.reports.build_report(
            summary,
            findings,
            llm["text"],
            monitoring_context=monitoring_context,
            quality_context=quality_context or {},
            training_context=training_context or {},
        )
        return RemediationResponse(
            summary=summary,
            findings=findings,
            recommendations=[item.recommended_action for item in findings],
            governance_report=report,
            llm_summary=llm["text"],
        )
