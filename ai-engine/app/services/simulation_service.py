from typing import List

import pandas as pd

from ..models.schemas import SimulationEvent, SimulationResponse
from ..monitoring.anomaly_detector import AnomalyDetector
from ..monitoring.bias_detector import BiasDetector
from ..monitoring.drift_detector import DriftDetector
from ..utils.config import settings
from .predictor import PredictionService
from ..utils.file_utils import load_csv


class SimulationService:
    def __init__(self):
        self.predictor = PredictionService()
        self.drift = DriftDetector()
        self.anomaly = AnomalyDetector()
        self.bias = BiasDetector()

    def stream_batch(
        self,
        file_path: str,
        model_id: str,
        cursor: int = 0,
        batch_size: int = 20,
        reference_file_path: str | None = None,
        target_column: str | None = None,
        sensitive_attributes: List[str] | None = None,
    ) -> SimulationResponse:
        df = load_csv(file_path)
        total_rows = len(df)
        cursor = max(0, cursor)
        end = min(total_rows, cursor + max(1, batch_size))
        batch_df = df.iloc[cursor:end]
        temp_path = self._write_temp_batch(batch_df)

        prediction_response = self.predictor.predict(temp_path, model_id)
        anomaly_result = self.anomaly.detect(temp_path)
        drift_score = None
        if reference_file_path:
            drift_score = self.drift.detect(temp_path, reference_file_path).drift_score

        fairness_flag = False
        if target_column and sensitive_attributes and target_column in batch_df.columns:
            bias_result = self.bias.audit(temp_path, target_column, sensitive_attributes)
            fairness_flag = bias_result.bias_detected

        anomaly_indices = set(anomaly_result.anomaly_indices)
        events = []
        for row in prediction_response.predictions:
            relative_index = row.row_index
            events.append(
                SimulationEvent(
                    index=cursor + relative_index,
                    prediction=row.prediction,
                    confidence=row.confidence,
                    drift_score=drift_score,
                    anomaly_flag=relative_index in anomaly_indices,
                    fairness_flag=fairness_flag,
                )
            )

        return SimulationResponse(
            cursor=cursor,
            next_cursor=end,
            total_rows=total_rows,
            has_more=end < total_rows,
            events=events,
            summary={
                "anomaly_rate": anomaly_result.anomaly_rate,
                "drift_score": drift_score,
                "batch_rows": len(batch_df),
                "fairness_flag": fairness_flag,
            },
        )

    def _write_temp_batch(self, batch_df: pd.DataFrame) -> str:
        settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        temp_path = settings.UPLOAD_DIR / "_simulation_batch.csv"
        batch_df.to_csv(temp_path, index=False)
        return str(temp_path)
