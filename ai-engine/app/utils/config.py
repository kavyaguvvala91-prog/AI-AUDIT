"""
Centralized environment-driven configuration for the AI engine.
"""

import os
from pathlib import Path

from dotenv import load_dotenv


SERVICE_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = SERVICE_ROOT / ".env"
load_dotenv(ENV_FILE)


def _resolve_service_path(env_key: str, default_dir: str) -> Path:
    raw_value = os.getenv(env_key, default_dir)
    path = Path(raw_value)
    return path if path.is_absolute() else SERVICE_ROOT / path


class Settings:
    # Directories
    SERVICE_ROOT: Path = SERVICE_ROOT
    UPLOAD_DIR: Path = _resolve_service_path("UPLOAD_DIR", "uploads")
    MODEL_DIR: Path = _resolve_service_path("MODEL_DIR", "saved_models")

    # ML
    TEST_SIZE: float = float(os.getenv("TEST_SIZE", "0.2"))
    RANDOM_STATE: int = int(os.getenv("RANDOM_STATE", "42"))

    # Drift
    DRIFT_THRESHOLD: float = float(os.getenv("DRIFT_THRESHOLD", "0.2"))

    # Anomaly detection
    ANOMALY_CONTAMINATION: float = float(os.getenv("ANOMALY_CONTAMINATION", "0.05"))

    # Governance / remediation
    AUTO_FIX_DRIFT_THRESHOLD: float = float(os.getenv("AUTO_FIX_DRIFT_THRESHOLD", "0.25"))
    AUTO_FIX_IMBALANCE_THRESHOLD: float = float(os.getenv("AUTO_FIX_IMBALANCE_THRESHOLD", "0.75"))
    AUTO_FIX_MISSING_THRESHOLD: float = float(os.getenv("AUTO_FIX_MISSING_THRESHOLD", "0.08"))
    AUTO_FIX_APPROVAL_REQUIRED: bool = os.getenv("AUTO_FIX_APPROVAL_REQUIRED", "true").lower() == "true"
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    LLM_TIMEOUT: int = int(os.getenv("LLM_TIMEOUT", "20"))
    LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "600"))

    # Classification label cardinality threshold
    CLASSIFICATION_THRESHOLD: float = 0.05
    MAX_CLASSIFICATION_CLASSES: int = 20


settings = Settings()
