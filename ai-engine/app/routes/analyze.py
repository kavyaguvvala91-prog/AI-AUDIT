"""
app/routes/analyze.py
──────────────────────
POST /api/v1/analyse
  Accepts a file path (sent by the Node.js backend after it stores the CSV).
  Returns a full dataset profile: column types, statistics, missing values,
  suggested target column, problem type, class distribution, and correlations.

POST /api/v1/analyse/upload
  Convenience endpoint: accepts a raw CSV file upload directly (no Node.js proxy needed).
  Saves the file to the uploads/ directory, then runs the same analysis.
"""

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..models.schemas import AnalyseRequest, AnalyseResponse
from ..services.analyzer import DatasetAnalyzer
from ..utils.config import settings
from ..utils.response import error, success

router = APIRouter()
_analyzer = DatasetAnalyzer()  # stateless — safe to share


@router.post("/analyse", response_model=None)
async def analyse_dataset(request: AnalyseRequest):
    """
    Analyse a CSV file at the given path.

    The Node.js backend sends `file_path` (the server-side path where Multer
    stored the uploaded CSV).  The AI engine reads it directly from disk.
    """
    try:
        result: AnalyseResponse = _analyzer.analyse(
            file_path=request.file_path,
            hint_columns=request.columns,
        )
        return success(data=result.model_dump(), message="Dataset analysis complete")
    except FileNotFoundError as exc:
        return error(str(exc), "FILE_NOT_FOUND", 404)
    except ValueError as exc:
        return error(str(exc), "INVALID_FILE", 422)
    except Exception as exc:
        return error(f"Analysis failed: {exc}", "ANALYSIS_ERROR", 500)


@router.post("/files/upload", response_model=None)
async def upload_file(file: UploadFile = File(...)):
    """
    Save a CSV file to the AI engine's local uploads directory and return
    the saved path so follow-up endpoints can operate on the same file.
    """
    if not file.filename.endswith((".csv", ".txt")):
        raise HTTPException(422, "Only CSV files are accepted.")

    dest = settings.UPLOAD_DIR / f"{uuid.uuid4()}-{file.filename}"
    dest.parent.mkdir(parents=True, exist_ok=True)

    try:
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        return success(
            data={
                "file_path": str(dest),
                "filename": file.filename,
            },
            message="File uploaded successfully",
            status_code=201,
        )
    except Exception as exc:
        dest.unlink(missing_ok=True)
        return error(f"Upload failed: {exc}", "UPLOAD_ERROR", 500)
    finally:
        file.file.close()


@router.post("/analyse/upload", response_model=None)
async def analyse_upload(file: UploadFile = File(...)):
    """
    Direct upload convenience endpoint.
    Saves the file locally, then runs analysis.  Useful for testing without
    the Node.js backend in the loop.
    """
    if not file.filename.endswith((".csv", ".txt")):
        raise HTTPException(422, "Only CSV files are accepted.")

    dest = settings.UPLOAD_DIR / f"{uuid.uuid4()}-{file.filename}"
    dest.parent.mkdir(parents=True, exist_ok=True)

    try:
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        result: AnalyseResponse = _analyzer.analyse(file_path=str(dest))
        return success(data=result.model_dump(), message="Dataset analysis complete")
    except Exception as exc:
        dest.unlink(missing_ok=True)
        return error(f"Analysis failed: {exc}", "ANALYSIS_ERROR", 500)
    finally:
        file.file.close()
