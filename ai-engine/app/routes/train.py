"""
app/routes/train.py
────────────────────
POST /api/v1/train
  Triggers AutoML training on an existing CSV file.
  The Node.js backend sends { file_path, target_column, config }.

  Returns:
    model_id      — UUID used in subsequent /predict and /monitor calls
    metrics       — accuracy / F1 or RMSE / R² + feature importances
    model_path    — where the model is saved on disk
"""

from fastapi import APIRouter

from ..models.schemas import TrainRequest, TrainResponse
from ..services.trainer import ModelTrainer
from ..utils.response import error, success

router = APIRouter()
_trainer = ModelTrainer()  # stateless service — safe to share


async def _run_training(request: TrainRequest):
    """
    AutoML training endpoint.

    Selects between LogisticRegression / RandomForestClassifier (classification)
    or LinearRegression / RandomForestRegressor (regression) based on the target
    column's data distribution. Returns the winning model's metrics and a
    `model_id` for follow-up /predict calls.
    """
    try:
        result: TrainResponse = _trainer.train(
            file_path=request.file_path,
            target_column=request.target_column,
            config=request.config or {},
        )
        return success(
            data=result.model_dump(),
            message=f"Model trained successfully ({result.metrics.model_type})",
            status_code=201,
        )
    except FileNotFoundError as exc:
        return error(str(exc), "FILE_NOT_FOUND", 404)
    except ValueError as exc:
        return error(str(exc), "VALIDATION_ERROR", 422)
    except RuntimeError as exc:
        return error(str(exc), "TRAINING_FAILED", 500)
    except Exception as exc:
        return error(f"Training failed: {exc}", "TRAINING_ERROR", 500)


@router.post("/train", response_model=None)
async def train_model(request: TrainRequest):
    """Primary training endpoint used by the documented FastAPI API."""
    return await _run_training(request)


@router.post("/automl", response_model=None)
async def automl_train(request: TrainRequest):
    """
    Compatibility alias used by the existing Node backend.
    Mirrors the exact behaviour of /train.
    """
    return await _run_training(request)
