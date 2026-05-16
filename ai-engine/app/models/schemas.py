from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class GovernanceBaseModel(BaseModel):
    model_config = ConfigDict(protected_namespaces=())


class ColumnInfo(GovernanceBaseModel):
    name: str
    dtype: str
    missing_count: int
    missing_pct: float
    unique_count: int
    mean: Optional[float] = None
    std: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    top_values: Optional[List[Any]] = None


class AnalyseRequest(GovernanceBaseModel):
    file_path: str = Field(..., description="Absolute or relative path to the CSV file.")
    columns: Optional[List[str]] = Field(default=None)


class AnalyseResponse(GovernanceBaseModel):
    file_path: str
    row_count: int
    column_count: int
    columns: List[str]
    numeric_columns: List[str]
    categorical_columns: List[str]
    datetime_columns: List[str]
    column_stats: List[ColumnInfo]
    missing_summary: Dict[str, float]
    suggested_target: Optional[str]
    problem_type: str
    class_distribution: Optional[Dict[str, int]]
    correlation_top5: Optional[Dict[str, float]]


class TrainRequest(GovernanceBaseModel):
    file_path: str
    target_column: str
    config: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ModelCandidateResult(GovernanceBaseModel):
    model_type: str
    ranking_score: float
    selection_metric: str
    metrics: Dict[str, Any]
    training_time_s: Optional[float] = None


class ModelMetrics(GovernanceBaseModel):
    model_type: str
    problem_type: str
    train_accuracy: Optional[float] = None
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    train_rmse: Optional[float] = None
    rmse: Optional[float] = None
    mae: Optional[float] = None
    r2: Optional[float] = None
    train_samples: int
    test_samples: int
    feature_count: int
    feature_importance: Optional[Dict[str, float]] = None
    training_time_s: Optional[float] = None
    leaderboard: List[ModelCandidateResult] = Field(default_factory=list)


class TrainResponse(GovernanceBaseModel):
    model_id: str
    target_column: str
    model_version: Optional[str] = None
    parent_model_id: Optional[str] = None
    metrics: ModelMetrics
    model_path: str
    preprocessing_path: str
    metadata_path: Optional[str] = None


class PredictRequest(GovernanceBaseModel):
    file_path: str = Field(..., description="Path to the CSV file to run predictions on.")
    model_id: str = Field(..., description="model_id returned by /train.")


class PredictionRow(GovernanceBaseModel):
    row_index: int
    prediction: Any
    confidence: Optional[float] = None
    probabilities: Optional[Dict[str, float]] = None


class PredictResponse(GovernanceBaseModel):
    model_id: str
    problem_type: str
    total_rows: int
    predictions: List[PredictionRow]
    summary: Dict[str, Any]


class DriftResult(GovernanceBaseModel):
    drifted: bool
    drift_score: float
    threshold: float
    column_drift: Dict[str, float]


class GroupFairnessMetric(GovernanceBaseModel):
    group: str
    count: int
    positive_rate: float
    parity_gap: float
    severity: str


class BiasResult(GovernanceBaseModel):
    target_column: str
    sensitive_attributes: List[str]
    bias_detected: bool
    fairness_score: Optional[float] = None
    bias_severity: Optional[str] = None
    group_metrics: Dict[str, Dict[str, Any]]
    group_summary: Dict[str, List[GroupFairnessMetric]] = Field(default_factory=dict)


class AnomalyResult(GovernanceBaseModel):
    total_anomalies: int
    anomaly_rate: float
    anomaly_indices: List[int]


class MonitorResult(GovernanceBaseModel):
    dataset_id: str
    drift: Optional[DriftResult] = None
    bias: Optional[BiasResult] = None
    anomaly: Optional[AnomalyResult] = None
    confidence_summary: Optional[Dict[str, float]] = None


class DriftRequest(GovernanceBaseModel):
    current_file_path: str
    reference_file_path: str


class BiasRequest(GovernanceBaseModel):
    file_path: str
    target_column: str
    sensitive_attributes: List[str]


class AnomalyRequest(GovernanceBaseModel):
    file_path: str
    columns: Optional[List[str]] = None


class QualityIssue(GovernanceBaseModel):
    issue: str
    severity: str
    value: float
    recommendation: str


class QualityResponse(GovernanceBaseModel):
    file_path: str
    quality_score: int
    summary: Dict[str, float]
    issues: List[QualityIssue]
    recommendations: List[str]


class ExplainRequest(GovernanceBaseModel):
    file_path: str
    model_id: str
    row_index: int = 0
    top_n: int = 5


class FeatureContribution(GovernanceBaseModel):
    feature: str
    contribution: float
    value: Any = None
    direction: str


class ExplainResponse(GovernanceBaseModel):
    model_id: str
    model_type: str
    problem_type: str
    confidence_score: Optional[float] = None
    prediction: Any = None
    top_features: List[FeatureContribution]
    local_explanation: List[FeatureContribution]
    global_explanation: List[FeatureContribution]
    reasoning: List[str]
    explanation_methods: List[str]


class RetrainRequest(GovernanceBaseModel):
    file_path: str
    target_column: str
    current_model_id: Optional[str] = None
    drift_score: Optional[float] = None
    config: Optional[Dict[str, Any]] = Field(default_factory=dict)


class MetricDelta(GovernanceBaseModel):
    metric: str
    old_value: Optional[float] = None
    new_value: Optional[float] = None
    delta: Optional[float] = None


class RetrainResponse(GovernanceBaseModel):
    triggered: bool
    reason: str
    drift_score: Optional[float] = None
    threshold: float
    previous_model_id: Optional[str] = None
    new_model_id: Optional[str] = None
    previous_version: Optional[str] = None
    new_version: Optional[str] = None
    comparison: List[MetricDelta] = Field(default_factory=list)
    training_result: Optional[TrainResponse] = None


class SimulationRequest(GovernanceBaseModel):
    file_path: str
    model_id: str
    cursor: int = 0
    batch_size: int = 20
    reference_file_path: Optional[str] = None
    target_column: Optional[str] = None
    sensitive_attributes: List[str] = Field(default_factory=list)


class SimulationEvent(GovernanceBaseModel):
    index: int
    prediction: Any
    confidence: Optional[float] = None
    drift_score: Optional[float] = None
    anomaly_flag: bool = False
    fairness_flag: bool = False


class SimulationResponse(GovernanceBaseModel):
    cursor: int
    next_cursor: int
    total_rows: int
    has_more: bool
    events: List[SimulationEvent]
    summary: Dict[str, Any]


class InsightRequest(GovernanceBaseModel):
    context: Dict[str, Any]
    preferred_provider: Optional[str] = None


class RecommendationItem(GovernanceBaseModel):
    code: str
    title: str
    severity: str
    risk_score: int
    rationale: str
    recommended_action: str
    auto_fix_available: bool = False


class GovernanceSummary(GovernanceBaseModel):
    model_health_score: int
    overall_risk_score: int
    severity: str
    status: str


class GovernanceSection(GovernanceBaseModel):
    title: str
    status: str
    summary: str
    metrics: Dict[str, Any] = Field(default_factory=dict)


class GovernanceReportResponse(GovernanceBaseModel):
    summary: GovernanceSummary
    findings: List[RecommendationItem]
    model_health: GovernanceSection
    drift_summary: GovernanceSection
    fairness_summary: GovernanceSection
    anomaly_summary: GovernanceSection
    confidence_analysis: GovernanceSection
    recommended_actions: List[str]
    retraining_recommendation: str
    narrative: str
    generated_at: str


class RemediationRequest(GovernanceBaseModel):
    monitoring_context: Dict[str, Any]
    quality_context: Optional[Dict[str, Any]] = None
    explanation_context: Optional[Dict[str, Any]] = None
    training_context: Optional[Dict[str, Any]] = None
    preferred_provider: Optional[str] = None


class RemediationResponse(GovernanceBaseModel):
    summary: GovernanceSummary
    findings: List[RecommendationItem]
    recommendations: List[str]
    governance_report: GovernanceReportResponse
    llm_summary: Optional[str] = None


class AutoFixRequest(GovernanceBaseModel):
    file_path: str
    target_column: str
    current_model_id: Optional[str] = None
    monitoring_context: Dict[str, Any]
    quality_context: Optional[Dict[str, Any]] = None
    training_context: Optional[Dict[str, Any]] = None
    approval_granted: bool = False
    config: Dict[str, Any] = Field(default_factory=dict)


class AutoFixActionResult(GovernanceBaseModel):
    action: str
    applied: bool
    details: str


class AutoFixResponse(GovernanceBaseModel):
    executed: bool
    approval_required: bool
    rollback_version: Optional[str] = None
    rollback_target_model_id: Optional[str] = None
    prepared_dataset_path: Optional[str] = None
    execution_logs: List[str] = Field(default_factory=list)
    history_entry: Dict[str, Any] = Field(default_factory=dict)
    actions: List[AutoFixActionResult]
    retraining: Optional[RetrainResponse] = None


class RollbackRequest(GovernanceBaseModel):
    target_model_id: str
    target_version: Optional[str] = None


class RollbackResponse(GovernanceBaseModel):
    success: bool
    target_model_id: str
    target_version: Optional[str] = None
    target_model_type: Optional[str] = None
    target_metrics: Dict[str, Any] = Field(default_factory=dict)
    message: str
