"""
app/utils/file_utils.py
────────────────────────
Utility functions for reading CSV files safely.
All ML services call these instead of calling pd.read_csv() directly,
so we have one place to handle encoding issues, empty files, etc.
"""

import logging
from pathlib import Path
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)


def load_csv(file_path: str | Path, nrows: Optional[int] = None) -> pd.DataFrame:
    """
    Load a CSV from disk into a DataFrame.
    Tries UTF-8 first, falls back to latin-1 for legacy files.

    Args:
        file_path: Path to the CSV file.
        nrows:     If set, only reads this many rows (useful for quick previews).

    Returns:
        DataFrame with the CSV contents.

    Raises:
        FileNotFoundError: if the file doesn't exist.
        ValueError:        if the file is empty or cannot be parsed.
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"CSV not found: {file_path}")

    try:
        df = pd.read_csv(path, nrows=nrows, encoding="utf-8")
    except UnicodeDecodeError:
        logger.warning(f"UTF-8 decode failed for {path.name}, retrying with latin-1")
        df = pd.read_csv(path, nrows=nrows, encoding="latin-1")

    if df.empty:
        raise ValueError(f"File is empty: {path.name}")

    logger.info(f"Loaded {path.name}: {df.shape[0]} rows × {df.shape[1]} cols")
    return df


def safe_column_name(name: str) -> str:
    """Normalise a column name to a safe identifier (lowercase, underscores)."""
    return str(name).strip().lower().replace(" ", "_").replace("-", "_")