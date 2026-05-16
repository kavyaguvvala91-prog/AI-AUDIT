import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple

import joblib

from ..utils.config import settings


def model_dir(model_id: str) -> Path:
    return settings.MODEL_DIR / model_id


def model_paths(model_id: str) -> Tuple[Path, Path, Path]:
    base = model_dir(model_id)
    return (
        base / "model.joblib",
        base / "preprocessor.joblib",
        base / "metadata.json",
    )


def write_metadata(model_id: str, metadata: Dict[str, Any]) -> Path:
    _, _, metadata_path = model_paths(model_id)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata = {
        **metadata,
        "saved_at": datetime.now(timezone.utc).isoformat(),
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata_path


def read_metadata(model_id: str) -> Dict[str, Any]:
    _, _, metadata_path = model_paths(model_id)
    if not metadata_path.exists():
        return {}
    return json.loads(metadata_path.read_text(encoding="utf-8"))


def save_artifacts(model_id: str, model: Any, cleaner: Any, metadata: Dict[str, Any]) -> Dict[str, str]:
    model_path, prep_path, metadata_path = model_paths(model_id)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path)
    joblib.dump(cleaner, prep_path)
    write_metadata(model_id, metadata)
    return {
        "model_path": str(model_path),
        "preprocessing_path": str(prep_path),
        "metadata_path": str(metadata_path),
    }


def load_artifacts(model_id: str) -> Tuple[Any, Any, Dict[str, Any]]:
    model_path, prep_path, _ = model_paths(model_id)
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_id}. Train a model first.")
    if not prep_path.exists():
        raise FileNotFoundError(f"Preprocessor not found for model: {model_id}.")
    model = joblib.load(model_path)
    cleaner = joblib.load(prep_path)
    metadata = read_metadata(model_id)
    return model, cleaner, metadata
