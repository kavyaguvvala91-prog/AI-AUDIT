"""
app/routes/predict.py
─────────────────────
POST /api/v1/predict
  Runs inference on a CSV file using a previously trained model.

Request body:
  {
    "file_path": "uploads/sample.csv",
    "model_id": "uuid-from-train"
  }

Returns:
  • per-row prediction values
  • confidence scores for classification models
  • class probabilities when available
  • aggregate prediction summary
"""

from fastapi import APIRouter

from app.models.schemas import PredictRequest, PredictResponse
from app.services.predictor import PredictionService
from app.utils.response import error, success

router = APIRouter()
_predictor = PredictionService()  # stateless service — safe to share


@router.post("/predict", response_model=None)
async def predict(request: PredictRequest):
    """
    Run batch predictions on the CSV file referenced by `file_path`
    using the trained model referenced by `model_id`.
    """
    try:
        result: PredictResponse = _predictor.predict(
            file_path=request.file_path,
            model_id=request.model_id,
        )
        return success(
            data=result.model_dump(),
            message=f"Predictions generated successfully for model {request.model_id}",
        )
    except FileNotFoundError as exc:
        return error(str(exc), "FILE_NOT_FOUND", 404)
    except ValueError as exc:
        return error(str(exc), "VALIDATION_ERROR", 422)
    except RuntimeError as exc:
        return error(str(exc), "PREDICTION_FAILED", 500)
    except Exception as exc:
        return error(f"Prediction failed: {exc}", "PREDICTION_ERROR", 500)
