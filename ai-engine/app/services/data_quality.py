from typing import List

import numpy as np

from ..models.schemas import QualityIssue, QualityResponse
from ..utils.file_utils import load_csv


class DataQualityService:
    def evaluate(self, file_path: str) -> QualityResponse:
        df = load_csv(file_path)
        total_cells = max(len(df) * max(len(df.columns), 1), 1)
        numeric_df = df.select_dtypes(include=[np.number])

        missing_pct = float(df.isna().sum().sum() / total_cells)
        duplicate_pct = float(df.duplicated().mean()) if len(df) else 0.0
        invalid_pct = float(sum((df[col].astype(str).str.strip() == "").sum() for col in df.columns) / total_cells)

        outlier_pct = 0.0
        if not numeric_df.empty:
            zscores = np.abs((numeric_df - numeric_df.mean()) / numeric_df.std(ddof=0).replace(0, 1))
            outlier_mask = (zscores > 3).fillna(False)
            outlier_pct = float(outlier_mask.any(axis=1).mean())

        imbalance_pct = 0.0
        for column in df.columns:
            if df[column].nunique(dropna=True) <= 10:
                distribution = df[column].value_counts(normalize=True, dropna=True)
                if not distribution.empty:
                    imbalance_pct = max(imbalance_pct, float(distribution.max()))

        penalties = {
            "missing": min(35, missing_pct * 100),
            "duplicates": min(20, duplicate_pct * 120),
            "invalid": min(15, invalid_pct * 100),
            "outliers": min(15, outlier_pct * 100),
            "imbalance": min(15, max(0.0, (imbalance_pct - 0.55)) * 40),
        }

        quality_score = int(max(0, round(100 - sum(penalties.values()))))
        issues: List[QualityIssue] = []

        if missing_pct > 0.02:
            issues.append(QualityIssue(issue="Missing values", severity=self._severity(missing_pct), value=round(missing_pct, 4), recommendation="Impute or remove rows with heavy null patterns before training."))
        if duplicate_pct > 0.01:
            issues.append(QualityIssue(issue="Duplicate rows", severity=self._severity(duplicate_pct), value=round(duplicate_pct, 4), recommendation="Deduplicate near-identical rows to avoid biased metrics and leakage."))
        if outlier_pct > 0.03:
            issues.append(QualityIssue(issue="Outlier concentration", severity=self._severity(outlier_pct), value=round(outlier_pct, 4), recommendation="Clip, transform, or review extreme values before deploying the model."))
        if imbalance_pct > 0.7:
            issues.append(QualityIssue(issue="Class or group imbalance", severity=self._severity(imbalance_pct - 0.5), value=round(imbalance_pct, 4), recommendation="Resample the minority class or collect more balanced data."))
        if invalid_pct > 0.01:
            issues.append(QualityIssue(issue="Invalid blank values", severity=self._severity(invalid_pct), value=round(invalid_pct, 4), recommendation="Normalize blank strings and invalid placeholders before preprocessing."))

        recommendations = [issue.recommendation for issue in issues]
        if not recommendations:
            recommendations.append("Dataset quality is healthy. Proceed with training and monitor drift over time.")

        return QualityResponse(
            file_path=file_path,
            quality_score=quality_score,
            summary={
                "missing_pct": round(missing_pct, 4),
                "duplicate_pct": round(duplicate_pct, 4),
                "invalid_pct": round(invalid_pct, 4),
                "outlier_pct": round(outlier_pct, 4),
                "imbalance_pct": round(imbalance_pct, 4),
            },
            issues=issues,
            recommendations=recommendations,
        )

    def _severity(self, value: float) -> str:
        if value >= 0.15:
            return "high"
        if value >= 0.05:
            return "medium"
        return "low"
