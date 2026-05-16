"""Dataset service for upload persistence and lightweight schema analysis."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from fastapi import HTTPException, UploadFile, status

from ..models.response_models import DatasetAnalysisResponse, UploadResponse
from ..utils.file_handler import persist_upload_file, read_metadata_file, write_metadata_file
from ..utils.helpers import (
    dataframe_preview,
    detect_categorical_columns,
    detect_missing_values,
    detect_numeric_columns,
    detect_problem_type,
    infer_possible_target_column,
    utc_timestamp,
)


class DatasetService:
    """Service responsible for CSV ingestion and reusable dataset analysis."""

    @staticmethod
    def _read_csv(file_path: Path) -> pd.DataFrame:
        """Read a CSV file with a small encoding fallback strategy."""
        try:
            return pd.read_csv(file_path)
        except UnicodeDecodeError:
            return pd.read_csv(file_path, encoding="latin-1")
        except pd.errors.EmptyDataError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded CSV file does not contain any rows.",
            ) from exc
        except pd.errors.ParserError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to parse the uploaded CSV file.",
            ) from exc

    async def upload_dataset(self, upload_file: UploadFile) -> UploadResponse:
        """Persist an uploaded CSV, inspect it, and return upload metadata."""
        dataset_id, stored_path = await persist_upload_file(upload_file)
        dataframe = self._read_csv(stored_path)

        if dataframe.empty and len(dataframe.columns) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded CSV file must contain at least one column.",
            )

        preview = dataframe_preview(dataframe)
        metadata = {
            "original_filename": upload_file.filename,
            "stored_filename": stored_path.name,
            "file_path": str(stored_path.resolve()),
            "rows": int(dataframe.shape[0]),
            "columns": int(dataframe.shape[1]),
            "column_names": dataframe.columns.tolist(),
            "preview": preview,
            "uploaded_at": utc_timestamp(),
        }
        write_metadata_file(dataset_id=dataset_id, metadata=metadata)

        return UploadResponse(
            message="Dataset uploaded successfully.",
            dataset_id=dataset_id,
            original_filename=metadata["original_filename"] or stored_path.name,
            stored_filename=metadata["stored_filename"],
            file_path=metadata["file_path"],
            rows=metadata["rows"],
            columns=metadata["columns"],
            column_names=metadata["column_names"],
            preview=metadata["preview"],
            uploaded_at=metadata["uploaded_at"],
        )

    def analyze_dataset(self, dataset_id: str) -> DatasetAnalysisResponse:
        """Analyze a previously uploaded dataset for dashboard and AutoML workflows."""
        metadata = read_metadata_file(dataset_id)
        file_path = Path(metadata["file_path"])

        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Uploaded CSV file not found for dataset_id='{dataset_id}'.",
            )

        dataframe = self._read_csv(file_path)
        possible_target = infer_possible_target_column(dataframe.columns)

        return DatasetAnalysisResponse(
            dataset_id=dataset_id,
            file_path=str(file_path.resolve()),
            shape={
                "rows": int(dataframe.shape[0]),
                "columns": int(dataframe.shape[1]),
            },
            numeric_columns=detect_numeric_columns(dataframe),
            categorical_columns=detect_categorical_columns(dataframe),
            missing_values=detect_missing_values(dataframe),
            possible_target_column=possible_target,
            problem_type=detect_problem_type(dataframe, possible_target),
            preview=dataframe_preview(dataframe),
        )
