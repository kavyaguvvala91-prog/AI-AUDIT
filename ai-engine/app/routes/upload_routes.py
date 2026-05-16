"""Dataset upload API routes."""

from fastapi import APIRouter, File, UploadFile, status

from app.models.response_models import ErrorResponse, UploadResponse
from app.services.dataset_service import DatasetService


router = APIRouter(tags=["upload"])
dataset_service = DatasetService()


@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        status.HTTP_400_BAD_REQUEST: {"model": ErrorResponse},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ErrorResponse},
    },
)
async def upload_dataset(file: UploadFile = File(...)) -> UploadResponse:
    """Upload a CSV dataset and store it locally for later analysis and training."""
    return await dataset_service.upload_dataset(file)
