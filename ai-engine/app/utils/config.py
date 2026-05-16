"""
app/utils/config.py
────────────────────
Centralises all environment-driven configuration.
Import `settings` anywhere instead of calling os.getenv() everywhere.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # Directories
    UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", "uploads"))
    MODEL_DIR: Path = Path(os.getenv("MODEL_DIR", "saved_models"))

    # ML
    TEST_SIZE: float = float(os.getenv("TEST_SIZE", "0.2"))
    RANDOM_STATE: int = int(os.getenv("RANDOM_STATE", "42"))

    # Drift
    DRIFT_THRESHOLD: float = float(os.getenv("DRIFT_THRESHOLD", "0.2"))

    # Anomaly detection
    ANOMALY_CONTAMINATION: float = float(os.getenv("ANOMALY_CONTAMINATION", "0.05"))

    # Classification label cardinality threshold:
    # if unique target values / total rows < this → classification
    CLASSIFICATION_THRESHOLD: float = 0.05
    MAX_CLASSIFICATION_CLASSES: int = 20


settings = Settings()