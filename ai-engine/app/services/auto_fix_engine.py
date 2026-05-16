from __future__ import annotations

from datetime import datetime, timezone
import uuid

import pandas as pd

from ..models.schemas import AutoFixResponse
from .fix_strategy_manager import FixStrategyManager
from .remediation_service import RemediationService
from .retraining_service import RetrainingService
from ..utils.config import settings
from ..utils.file_utils import load_csv


class AutoFixEngine:
    def __init__(self):
        self.remediation = RemediationService()
        self.strategies = FixStrategyManager()
        self.retraining = RetrainingService()

    def execute(
        self,
        file_path: str,
        target_column: str,
        current_model_id: str | None,
        monitoring_context: dict,
        quality_context: dict | None = None,
        training_context: dict | None = None,
        approval_granted: bool = False,
        config: dict | None = None,
    ) -> AutoFixResponse:
        quality_context = quality_context or {}
        training_context = training_context or {}

        remediation = self.remediation.assess(
            monitoring_context,
            quality_context,
            training_context=training_context,
        )
        actions = self.strategies.build_actions(
            remediation.findings,
            approval_granted,
            monitoring_context=monitoring_context,
            quality_context=quality_context,
        )

        working_file_path = file_path
        execution_logs = [
            "Auto-fix assessment started.",
            f"Approval granted: {'yes' if approval_granted else 'no'}.",
            f"Recommendations considered: {len(remediation.findings)}.",
        ]
        applied_actions = {action.action for action in actions if action.applied}
        skipped_actions = [action.action for action in actions if not action.applied]

        if applied_actions:
            execution_logs.append(f"Applied actions: {', '.join(sorted(applied_actions))}.")
        if skipped_actions:
            execution_logs.append(f"Deferred actions: {', '.join(sorted(skipped_actions))}.")

        if "clean_missing_values" in applied_actions or "rebalance_training_data" in applied_actions:
            working_file_path = self._prepare_working_dataset(
                file_path=file_path,
                target_column=target_column,
                apply_cleanup="clean_missing_values" in applied_actions,
                apply_rebalance="rebalance_training_data" in applied_actions,
            )
            execution_logs.append(f"Prepared remediation dataset at {working_file_path}.")

        retraining = None
        if "retrain_model" in applied_actions:
            retraining = self.retraining.retrain_if_needed(
                file_path=working_file_path,
                target_column=target_column,
                current_model_id=current_model_id,
                drift_score=(monitoring_context.get("drift") or {}).get("drift_score"),
                config={
                    **(config or {}),
                    "auto_fix_source_file": working_file_path,
                },
            )
            execution_logs.append(
                "Triggered automated retraining."
                if retraining.triggered
                else "Retraining criteria were evaluated but a new model was not created."
            )

        rollback_version = current_model_id if current_model_id else None
        history_entry = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "approval_granted": approval_granted,
            "executed": bool(applied_actions),
            "actions": [action.model_dump() for action in actions],
            "prepared_dataset_path": working_file_path if working_file_path != file_path else None,
            "rollback_version": rollback_version,
            "rollback_target_model_id": current_model_id,
            "retraining_triggered": bool(retraining and retraining.triggered),
        }

        return AutoFixResponse(
            executed=bool(applied_actions),
            approval_required=settings.AUTO_FIX_APPROVAL_REQUIRED and not approval_granted,
            rollback_version=rollback_version,
            rollback_target_model_id=current_model_id,
            prepared_dataset_path=working_file_path if working_file_path != file_path else None,
            execution_logs=execution_logs,
            history_entry=history_entry,
            actions=[
                self._with_dataset_details(action, working_file_path if working_file_path != file_path else None)
                for action in actions
            ],
            retraining=retraining,
        )

    def _prepare_working_dataset(
        self,
        file_path: str,
        target_column: str,
        apply_cleanup: bool,
        apply_rebalance: bool,
    ) -> str:
        df = load_csv(file_path).copy()

        if apply_cleanup:
            df = self._clean_missing_values(df)
        if apply_rebalance and target_column in df.columns:
            df = self._rebalance_dataset(df, target_column)

        output_dir = settings.UPLOAD_DIR / "autofix"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"autofix_{uuid.uuid4().hex}.csv"
        df.to_csv(output_path, index=False)
        return str(output_path)

    def _clean_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        cleaned = df.replace(r"^\s*$", pd.NA, regex=True)
        for column in cleaned.columns:
            series = cleaned[column]
            if pd.api.types.is_numeric_dtype(series):
                cleaned[column] = series.fillna(series.median())
            else:
                mode = series.mode(dropna=True)
                fallback = mode.iloc[0] if not mode.empty else "unknown"
                cleaned[column] = series.fillna(fallback)
        return cleaned

    def _rebalance_dataset(self, df: pd.DataFrame, target_column: str) -> pd.DataFrame:
        distribution = df[target_column].value_counts(dropna=False)
        if distribution.empty or len(distribution) <= 1:
            return df

        max_count = int(distribution.max())
        groups = []
        for label, group in df.groupby(target_column, dropna=False):
            if len(group) == 0:
                continue
            sampled = group.sample(
                n=max_count,
                replace=len(group) < max_count,
                random_state=settings.RANDOM_STATE,
            )
            groups.append(sampled)
        if not groups:
            return df
        rebalanced = pd.concat(groups, ignore_index=True)
        return rebalanced.sample(frac=1.0, random_state=settings.RANDOM_STATE).reset_index(drop=True)

    def _with_dataset_details(self, action, prepared_path: str | None):
        if prepared_path and action.action in {"clean_missing_values", "rebalance_training_data", "retrain_model"}:
            action.details = f"{action.details} Prepared dataset: {prepared_path}"
        return action
