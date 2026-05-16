from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import FileResponse

from ..models.schemas import AutoFixRequest, ExplainRequest, InsightRequest, RemediationRequest, RetrainRequest, RollbackRequest, SimulationRequest
from ..services.ai_insight_service import AIInsightService
from ..services.auto_fix_engine import AutoFixEngine
from ..services.data_quality import DataQualityService
from ..services.explainability_service import ExplainabilityService
from ..services.governance_report_service import GovernanceReportService
from ..services.model_registry import read_metadata
from ..services.remediation_service import RemediationService
from ..services.retraining_service import RetrainingService
from ..services.simulation_service import SimulationService
from ..utils.config import settings
from ..utils.response import error, success

router = APIRouter()
_quality = DataQualityService()
_explain = ExplainabilityService()
_retrain = RetrainingService()
_simulate = SimulationService()
_remediate = RemediationService()
_autofix = AutoFixEngine()
_insights = AIInsightService()
_reports = GovernanceReportService()


@router.get("/quality", response_model=None)
async def quality_report(file_path: str):
    try:
        result = _quality.evaluate(file_path)
        return success(data=result.model_dump(), message="Data quality report generated")
    except FileNotFoundError as exc:
        return error(str(exc), "FILE_NOT_FOUND", 404)
    except Exception as exc:
        return error(f"Quality analysis failed: {exc}", "QUALITY_ERROR", 500)


@router.post("/explanations", response_model=None)
async def explain_prediction(request: ExplainRequest):
    try:
        result = _explain.explain(
            file_path=request.file_path,
            model_id=request.model_id,
            row_index=request.row_index,
            top_n=request.top_n,
        )
        return success(data=result.model_dump(), message="Explainability report generated")
    except FileNotFoundError as exc:
        return error(str(exc), "FILE_NOT_FOUND", 404)
    except ValueError as exc:
        return error(str(exc), "VALIDATION_ERROR", 422)
    except Exception as exc:
        return error(f"Explainability failed: {exc}", "EXPLAINABILITY_ERROR", 500)


@router.post("/retrain", response_model=None)
async def retrain_model(request: RetrainRequest):
    try:
        result = _retrain.retrain_if_needed(
            file_path=request.file_path,
            target_column=request.target_column,
            current_model_id=request.current_model_id,
            drift_score=request.drift_score,
            config=request.config,
        )
        return success(
            data=result.model_dump(),
            message="Retraining completed" if result.triggered else "Retraining skipped",
            status_code=201 if result.triggered else 200,
        )
    except FileNotFoundError as exc:
        return error(str(exc), "FILE_NOT_FOUND", 404)
    except ValueError as exc:
        return error(str(exc), "VALIDATION_ERROR", 422)
    except Exception as exc:
        return error(f"Retraining failed: {exc}", "RETRAIN_ERROR", 500)


@router.post("/simulate", response_model=None)
async def simulate_realtime(request: SimulationRequest):
    try:
        result = _simulate.stream_batch(
            file_path=request.file_path,
            model_id=request.model_id,
            cursor=request.cursor,
            batch_size=request.batch_size,
            reference_file_path=request.reference_file_path,
            target_column=request.target_column,
            sensitive_attributes=request.sensitive_attributes,
        )
        return success(data=result.model_dump(), message="Simulation batch generated")
    except FileNotFoundError as exc:
        return error(str(exc), "FILE_NOT_FOUND", 404)
    except ValueError as exc:
        return error(str(exc), "VALIDATION_ERROR", 422)
    except Exception as exc:
        return error(f"Simulation failed: {exc}", "SIMULATION_ERROR", 500)


@router.post("/remediation/recommend", response_model=None)
async def recommend_remediation(request: RemediationRequest):
    try:
        result = _remediate.assess(
            monitoring_context=request.monitoring_context,
            quality_context=request.quality_context,
            explanation_context=request.explanation_context,
            training_context=request.training_context,
            preferred_provider=request.preferred_provider,
        )
        return success(data=result.model_dump(), message="Remediation recommendations generated")
    except Exception as exc:
        return error(f"Remediation generation failed: {exc}", "REMEDIATION_ERROR", 500)


@router.post("/remediation/autofix", response_model=None)
async def auto_fix(request: AutoFixRequest):
    try:
        result = _autofix.execute(
            file_path=request.file_path,
            target_column=request.target_column,
            current_model_id=request.current_model_id,
            monitoring_context=request.monitoring_context,
            quality_context=request.quality_context,
            training_context=request.training_context,
            approval_granted=request.approval_granted,
            config=request.config,
        )
        return success(data=result.model_dump(), message="Auto-fix flow executed")
    except Exception as exc:
        return error(f"Auto-fix failed: {exc}", "AUTO_FIX_ERROR", 500)


@router.post("/governance/report", response_model=None)
async def governance_report(request: RemediationRequest, format: str = "json"):
    try:
        remediation = _remediate.assess(
            monitoring_context=request.monitoring_context,
            quality_context=request.quality_context,
            explanation_context=request.explanation_context,
            training_context=request.training_context,
            preferred_provider=request.preferred_provider,
        )
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        if format == "pdf":
            path = _reports.export_pdf(
                remediation.governance_report,
                str(settings.MODEL_DIR / "reports" / f"governance_{timestamp}.pdf"),
            )
            return FileResponse(path, media_type="application/pdf", filename=f"governance_{timestamp}.pdf")
        path = _reports.export_json(
            remediation.governance_report,
            str(settings.MODEL_DIR / "reports" / f"governance_{timestamp}.json"),
        )
        return FileResponse(path, media_type="application/json", filename=f"governance_{timestamp}.json")
    except Exception as exc:
        return error(f"Governance report generation failed: {exc}", "GOVERNANCE_REPORT_ERROR", 500)


@router.post("/insights/generate", response_model=None)
async def generate_insights(request: InsightRequest):
    try:
        result = _insights.governance_summary(request.context, preferred_provider=request.preferred_provider)
        return success(data=result, message="Governance insights generated")
    except Exception as exc:
        return error(f"Insight generation failed: {exc}", "INSIGHT_ERROR", 500)


@router.post("/model/retrain", response_model=None)
async def model_retrain(request: RetrainRequest):
    return await retrain_model(request)


@router.post("/model/rollback", response_model=None)
async def model_rollback(request: RollbackRequest):
    try:
        metadata = read_metadata(request.target_model_id)
        if not metadata:
            raise FileNotFoundError(f"Model metadata not found for {request.target_model_id}")
        return success(
            data={
                "success": True,
                "target_model_id": request.target_model_id,
                "target_version": request.target_version or metadata.get("version"),
                "target_model_type": metadata.get("model_type"),
                "target_metrics": metadata.get("metrics", {}),
                "message": "Rollback target validated",
            },
            message="Rollback target prepared",
        )
    except FileNotFoundError as exc:
        return error(str(exc), "FILE_NOT_FOUND", 404)
    except Exception as exc:
        return error(f"Rollback validation failed: {exc}", "ROLLBACK_ERROR", 500)
