"""
app/routes/monitor.py
─────────────────────
GET /api/v1/monitor
  Aggregates drift, anomaly, bias, confidence, and feature-importance
  signals for a dataset and optional trained model.

Typical usage:
  /api/v1/monitor?dataset_id=batch-001&current_file_path=uploads/current.csv
  /api/v1/monitor?dataset_id=batch-001&current_file_path=uploads/current.csv&reference_file_path=uploads/baseline.csv
  /api/v1/monitor?dataset_id=batch-001&current_file_path=uploads/current.csv&model_id=<uuid>
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.models.schemas import AnomalyRequest, BiasRequest, DriftRequest
from app.monitoring.anomaly_detector import AnomalyDetector
from app.monitoring.bias_detector import BiasDetector
from app.monitoring.drift_detector import DriftDetector
from app.services.monitoring_service import MonitoringService
from app.utils.response import error, success

router = APIRouter()
_monitoring = MonitoringService()  # stateless aggregator — safe to share
_drift_detector = DriftDetector()
_bias_detector = BiasDetector()
_anomaly_detector = AnomalyDetector()


@router.get("/monitor", response_model=None)
async def monitor(
    dataset_id: str = Query(..., description="Client-side dataset identifier for dashboard grouping."),
    current_file_path: str = Query(..., description="Path to the current dataset to inspect."),
    reference_file_path: Optional[str] = Query(
        default=None,
        description="Optional baseline dataset path for drift detection.",
    ),
    model_id: Optional[str] = Query(
        default=None,
        description="Optional trained model ID for confidence and feature-importance metrics.",
    ),
    target_column: Optional[str] = Query(
        default=None,
        description="Optional target column used for bias analysis.",
    ),
    sensitive_attributes: Optional[list[str]] = Query(
        default=None,
        description="Optional sensitive attribute columns for fairness checks.",
    ),
    columns: Optional[list[str]] = Query(
        default=None,
        description="Optional numeric columns to restrict anomaly detection to.",
    ),
):
    """
    Aggregate all monitoring signals into one dashboard-friendly response.

    Every section is optional where appropriate:
      • drift requires both current and reference datasets
      • bias requires a target column and sensitive attributes
      • confidence / feature importance require a trained model ID
    """
    try:
        result = _monitoring.monitor(
            dataset_id=dataset_id,
            current_file_path=current_file_path,
            reference_file_path=reference_file_path,
            model_id=model_id,
            target_column=target_column,
            sensitive_attributes=sensitive_attributes or [],
            columns=columns,
        )
        return success(data=result, message="Monitoring metrics generated successfully")
    except FileNotFoundError as exc:
        return error(str(exc), "FILE_NOT_FOUND", 404)
    except ValueError as exc:
        return error(str(exc), "VALIDATION_ERROR", 422)
    except RuntimeError as exc:
        return error(str(exc), "MONITORING_FAILED", 500)
    except Exception as exc:
        return error(f"Monitoring failed: {exc}", "MONITORING_ERROR", 500)


@router.post("/drift", response_model=None)
async def detect_drift(request: DriftRequest):
    """Compatibility endpoint for the Node backend's drift job contract."""
    try:
        result = _drift_detector.detect(
            current_file=request.current_file_path,
            reference_file=request.reference_file_path,
        )
        return success(data=result.model_dump(), message="Drift detection completed")
    except FileNotFoundError as exc:
        return error(str(exc), "FILE_NOT_FOUND", 404)
    except ValueError as exc:
        return error(str(exc), "VALIDATION_ERROR", 422)
    except Exception as exc:
        return error(f"Drift detection failed: {exc}", "DRIFT_ERROR", 500)


@router.post("/bias", response_model=None)
async def detect_bias(request: BiasRequest):
    """Compatibility endpoint for fairness auditing requested by the Node backend."""
    try:
        result = _bias_detector.audit(
            file_path=request.file_path,
            target_column=request.target_column,
            sensitive_attributes=request.sensitive_attributes,
        )
        return success(data=result.model_dump(), message="Bias audit completed")
    except FileNotFoundError as exc:
        return error(str(exc), "FILE_NOT_FOUND", 404)
    except ValueError as exc:
        return error(str(exc), "VALIDATION_ERROR", 422)
    except Exception as exc:
        return error(f"Bias audit failed: {exc}", "BIAS_ERROR", 500)


@router.post("/anomaly", response_model=None)
async def detect_anomalies(request: AnomalyRequest):
    """Compatibility endpoint for anomaly detection requested by the Node backend."""
    try:
        result = _anomaly_detector.detect(
            file_path=request.file_path,
            columns=request.columns,
        )
        return success(data=result.model_dump(), message="Anomaly detection completed")
    except FileNotFoundError as exc:
        return error(str(exc), "FILE_NOT_FOUND", 404)
    except ValueError as exc:
        return error(str(exc), "VALIDATION_ERROR", 422)
    except Exception as exc:
        return error(f"Anomaly detection failed: {exc}", "ANOMALY_ERROR", 500)
