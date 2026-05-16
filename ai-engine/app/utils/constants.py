"""Shared constants used across the AI engine."""

from pathlib import Path


# Base directory for the Python AI engine package.
BASE_DIR = Path(__file__).resolve().parents[2]

# Runtime directories for uploaded datasets and persisted model artifacts.
UPLOADS_DIR = BASE_DIR / "uploads"
SAVED_MODELS_DIR = BASE_DIR / "saved_models"

# Allowed file extensions for dataset upload.
SUPPORTED_UPLOAD_EXTENSIONS = {".csv"}

# Heuristic rules for inferring likely target columns from dataset schemas.
TARGET_COLUMN_KEYWORDS = {
    "target",
    "label",
    "class",
    "outcome",
    "result",
    "prediction",
    "y",
    "response",
}

# Data quality thresholds used during lightweight dataset analysis.
HIGH_CARDINALITY_THRESHOLD = 50
MAX_PREVIEW_ROWS = 5
