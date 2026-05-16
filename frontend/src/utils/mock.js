export const mockAnalysis = {
  dataset_id: 'demo-001',
  filename: 'customer_churn.csv',
  shape: { rows: 7043, cols: 21 },
  numeric_columns: ['tenure', 'MonthlyCharges', 'TotalCharges', 'SeniorCitizen'],
  categorical_columns: ['gender', 'Partner', 'Dependents', 'PhoneService', 'Contract', 'PaymentMethod'],
  missing_values: { TotalCharges: 11, MonthlyCharges: 0, tenure: 0 },
  target_column: 'Churn',
  problem_type: 'Binary Classification',
  class_distribution: { Yes: 1869, No: 5174 },
  column_stats: [
    { name: 'tenure', mean: 32.4, std: 24.6, min: 0, max: 72 },
    { name: 'MonthlyCharges', mean: 64.76, std: 30.09, min: 18.25, max: 118.75 },
    { name: 'TotalCharges', mean: 2283.3, std: 2266.77, min: 18.8, max: 8684.8 },
  ],
  monthly_trend: [
    { month: 'Jan', value: 540 }, { month: 'Feb', value: 620 },
    { month: 'Mar', value: 480 }, { month: 'Apr', value: 700 },
    { month: 'May', value: 590 }, { month: 'Jun', value: 810 },
  ],
}

export const mockMetrics = {
  model_id: 'model-demo-001',
  model_type: 'RandomForestClassifier',
  accuracy: 0.847,
  precision: 0.791,
  recall: 0.763,
  f1_score: 0.777,
  rmse: null,
  auc_roc: 0.863,
  training_time_s: 12.4,
  history: [
    { epoch: 1, train_acc: 0.72, val_acc: 0.70 },
    { epoch: 2, train_acc: 0.78, val_acc: 0.75 },
    { epoch: 3, train_acc: 0.82, val_acc: 0.80 },
    { epoch: 4, train_acc: 0.84, val_acc: 0.83 },
    { epoch: 5, train_acc: 0.85, val_acc: 0.847 },
  ],
  confusion_matrix: [[4782, 392], [439, 1430]],
  feature_importance: {
    tenure: 0.231,
    MonthlyCharges: 0.198,
    TotalCharges: 0.187,
    Contract: 0.143,
  },
  leaderboard: [
    { model_type: 'RandomForestClassifier', ranking_score: 0.777, selection_metric: 'f1_score', training_time_s: 12.4, metrics: { accuracy: 0.847, precision: 0.791, recall: 0.763, f1_score: 0.777 } },
    { model_type: 'LogisticRegression', ranking_score: 0.751, selection_metric: 'f1_score', training_time_s: 4.3, metrics: { accuracy: 0.821, precision: 0.744, recall: 0.758, f1_score: 0.751 } },
    { model_type: 'DecisionTreeClassifier', ranking_score: 0.712, selection_metric: 'f1_score', training_time_s: 2.1, metrics: { accuracy: 0.803, precision: 0.701, recall: 0.723, f1_score: 0.712 } },
  ],
}

export const mockMonitoring = {
  drift_score: 0.14,
  drift_threshold: 0.2,
  drift_detected: false,
  drift_status: 'Low',
  anomaly_count: 23,
  anomaly_rate: 0.0033,
  anomaly_indices: [12, 47, 91, 144],
  suspicious_predictions: [
    { row_index: 12, prediction: 'N', confidence: 0.54, flagged_as_anomaly: true },
    { row_index: 47, prediction: 'Y', confidence: 0.57, flagged_as_anomaly: false },
    { row_index: 91, prediction: 'N', confidence: 0.49, flagged_as_anomaly: true },
  ],
  confidence_mean: 0.832,
  confidence_std: 0.094,
  confidence_min: 0.51,
  confidence_max: 0.98,
  low_confidence_count: 563,
  low_confidence_rate: 0.08,
  bias_score: 0.07,
  fairness_score: 0.93,
  bias_detected: true,
  bias_features: ['gender', 'SeniorCitizen'],
  fairness_groups: [
    { attribute: 'gender', group: 'Female', count: 340, positive_rate: 0.42, parity_gap: 0.16, severity: 'medium' },
    { attribute: 'gender', group: 'Male', count: 360, positive_rate: 0.58, parity_gap: 0, severity: 'low' },
  ],
  sensitive_attributes: ['gender'],
  feature_importance: [
    { feature: 'tenure', importance: 0.231 },
    { feature: 'MonthlyCharges', importance: 0.198 },
    { feature: 'TotalCharges', importance: 0.187 },
    { feature: 'Contract', importance: 0.143 },
  ],
  top_drift_columns: [
    { feature: 'MonthlyCharges', score: 0.18 },
    { feature: 'tenure', score: 0.15 },
    { feature: 'Contract', score: 0.12 },
  ],
  drift_history: [
    { day: 'Day 1', score: 0.04 },
    { day: 'Day 2', score: 0.06 },
    { day: 'Day 3', score: 0.09 },
    { day: 'Day 4', score: 0.11 },
    { day: 'Day 5', score: 0.14 },
  ],
  confidence_dist: [
    { range: '0.5-0.6', count: 142 },
    { range: '0.6-0.7', count: 389 },
    { range: '0.7-0.8', count: 1204 },
    { range: '0.8-0.9', count: 2871 },
    { range: '0.9-1.0', count: 2437 },
  ],
  target_column: 'Loan_Status',
  reference_dataset_id: 'demo-reference-001',
  prediction_summary: {
    value_counts: {
      Y: 412,
      N: 202,
    },
  },
}

export const mockQuality = {
  quality_score: 82,
  summary: {
    missing_pct: 0.031,
    duplicate_pct: 0.012,
    invalid_pct: 0.004,
    outlier_pct: 0.051,
    imbalance_pct: 0.68,
  },
  issues: [
    { issue: 'Missing values', severity: 'medium', value: 0.031, recommendation: 'Impute key financial fields before training.' },
    { issue: 'Outlier concentration', severity: 'medium', value: 0.051, recommendation: 'Review extreme debt ratios and income spikes.' },
  ],
  recommendations: [
    'Impute or remove null-heavy records.',
    'Standardize financial outliers before retraining.',
    'Monitor class balance during production ingestion.',
  ],
}

export const mockExplainability = {
  prediction: 'Rejected',
  confidence_score: 0.88,
  model_type: 'RandomForestClassifier',
  problem_type: 'classification',
  top_features: [
    { feature: 'credit_score', contribution: 0.31, direction: 'down', value: 540 },
    { feature: 'income', contribution: 0.24, direction: 'down', value: 32000 },
    { feature: 'debt_ratio', contribution: 0.19, direction: 'up', value: 0.61 },
  ],
  local_explanation: [
    { feature: 'credit_score', contribution: -0.31, direction: 'down', value: 540 },
    { feature: 'income', contribution: -0.24, direction: 'down', value: 32000 },
    { feature: 'debt_ratio', contribution: 0.19, direction: 'up', value: 0.61 },
  ],
  global_explanation: [
    { feature: 'credit_score', contribution: 0.31, direction: 'up' },
    { feature: 'income', contribution: 0.24, direction: 'up' },
    { feature: 'debt_ratio', contribution: 0.19, direction: 'up' },
    { feature: 'loan_amount', contribution: 0.12, direction: 'up' },
  ],
  reasoning: [
    'Loan rejected because credit_score pushed the prediction down.',
    'Loan rejected because income pushed the prediction down.',
    'High debt_ratio raised risk for this applicant.',
  ],
  explanation_methods: ['shap', 'lime'],
}

export const mockRetraining = {
  currentModel: { modelId: 'model-demo-002', version: 'v2', modelType: 'RandomForestClassifier', targetColumn: 'Churn', trainedAt: new Date().toISOString() },
  retraining: { payload: { data: { triggered: true, drift_score: 0.23, threshold: 0.2, previous_version: 'v1', new_version: 'v2', comparison: [{ metric: 'f1_score', old_value: 0.777, new_value: 0.804, delta: 0.027 }] } } },
  modelVersions: [
    { modelId: 'model-demo-001', version: 'v1', modelType: 'LogisticRegression', metrics: { accuracy: 0.821, precision: 0.744, recall: 0.758, f1_score: 0.751 }, createdAt: new Date(Date.now() - 86400000).toISOString() },
    { modelId: 'model-demo-002', version: 'v2', modelType: 'RandomForestClassifier', metrics: { accuracy: 0.851, precision: 0.806, recall: 0.802, f1_score: 0.804 }, createdAt: new Date().toISOString() },
  ],
  retrainingHistory: [
    { triggered: true, reason: 'Automatic retraining triggered by detected drift.', driftScore: 0.23, threshold: 0.2, previousVersion: 'v1', newVersion: 'v2', comparison: [{ metric: 'f1_score', old_value: 0.777, new_value: 0.804, delta: 0.027 }], createdAt: new Date().toISOString() },
  ],
  autoRetrainEnabled: true,
}

export const mockRealtime = {
  cursor: 0,
  next_cursor: 20,
  total_rows: 120,
  has_more: true,
  events: Array.from({ length: 8 }).map((_, index) => ({
    index,
    prediction: index % 3 === 0 ? 'Rejected' : 'Approved',
    confidence: 0.62 + (index * 0.04),
    drift_score: 0.12 + ((index % 4) * 0.01),
    anomaly_flag: index === 5,
    fairness_flag: index === 2,
  })),
  summary: { anomaly_rate: 0.03, drift_score: 0.15, batch_rows: 20, fairness_flag: true },
}

export const mockFairness = {
  fairness_score: 0.78,
  bias_detected: true,
  bias_severity: 'medium',
  sensitive_attributes: ['gender', 'income_band'],
  group_summary: {
    gender: [
      { group: 'Female', count: 340, positive_rate: 0.42, parity_gap: 0.16, severity: 'medium' },
      { group: 'Male', count: 360, positive_rate: 0.58, parity_gap: 0, severity: 'low' },
    ],
    income_band: [
      { group: 'Low', count: 220, positive_rate: 0.35, parity_gap: 0.19, severity: 'medium' },
      { group: 'High', count: 280, positive_rate: 0.54, parity_gap: 0, severity: 'low' },
    ],
  },
}

export const mockInsights = {
  provider: 'rule-based',
  model: 'local',
  text: 'Model drift is elevated and fairness gaps are visible across gender and income bands. Retraining improved the F1 score, but data quality issues around missing values and outliers still need attention. Recommendations: 1. Monitor drift daily. 2. Review fairness gaps on sensitive groups. 3. Promote new versions only when metric gains are consistent.',
}

export const mockGovernance = {
  dataset: {
    id: 'demo-001',
    name: 'customer_churn.csv',
    rows: 7043,
    columns: 21,
    target_column: 'Churn',
    model_id: 'model-demo-001',
    model_type: 'RandomForestClassifier',
    sensitive_attributes: ['gender', 'income_band'],
    reference_dataset_id: null,
  },
  summary: {
    model_health_score: 71,
    overall_risk_score: 64,
    severity: 'medium',
    status: 'action_required',
    risk_level: 'medium',
  },
  alerts: [
    {
      severity: 'medium',
      title: 'Overall governance risk is medium',
      detail: 'Model health is 71/100 with an overall risk score of 64/100.',
    },
    {
      severity: 'high',
      title: 'Drift threshold exceeded',
      detail: 'Drift score 0.23 is above threshold 0.2.',
    },
    {
      severity: 'medium',
      title: 'Fairness issue detected',
      detail: '2 sensitive groups show elevated parity gaps.',
    },
  ],
  warnings: [
    'Drift history is based on the latest available baseline comparison.',
  ],
  monitoring: {
    drift: {
      score: 0.23,
      threshold: 0.2,
      drifted: true,
      severity: 'high',
      affected_features: [
        { feature: 'income_band', score: 0.31 },
        { feature: 'tenure', score: 0.25 },
        { feature: 'MonthlyCharges', score: 0.18 },
      ],
      trend: [
        { label: 'May 10', score: 0.08 },
        { label: 'May 12', score: 0.11 },
        { label: 'May 14', score: 0.18 },
        { label: 'May 17', score: 0.23 },
      ],
      reference_dataset_id: null,
    },
    bias: {
      bias_detected: true,
      fairness_score: 0.78,
      severity: 'medium',
      sensitive_attributes: ['gender', 'income_band'],
      affected_groups: [
        { attribute: 'gender', group: 'Female', parity_gap: 0.16, positive_rate: 0.42, severity: 'medium' },
        { attribute: 'income_band', group: 'Low', parity_gap: 0.19, positive_rate: 0.35, severity: 'medium' },
      ],
      heatmap: [
        { attribute: 'gender', group: 'Female', count: 340, parity_gap: 0.16, positive_rate: 0.42, severity: 'medium' },
        { attribute: 'gender', group: 'Male', count: 360, parity_gap: 0, positive_rate: 0.58, severity: 'low' },
        { attribute: 'income_band', group: 'Low', count: 220, parity_gap: 0.19, positive_rate: 0.35, severity: 'medium' },
        { attribute: 'income_band', group: 'High', count: 280, parity_gap: 0, positive_rate: 0.54, severity: 'low' },
      ],
    },
    anomaly: {
      count: 23,
      rate: 0.033,
      severity: 'medium',
      sample_indices: [15, 44, 61],
      suspicious_predictions: [
        { row_index: 15, prediction: 'Rejected', confidence: 0.44, flagged_as_anomaly: true },
        { row_index: 44, prediction: 'Rejected', confidence: 0.51, flagged_as_anomaly: true },
        { row_index: 61, prediction: 'Approved', confidence: 0.53, flagged_as_anomaly: false },
      ],
      trend: [
        { label: 'May 17', rate: 0.033, count: 23 },
      ],
    },
    confidence: {
      average: 0.832,
      min: 0.51,
      max: 0.98,
      low_confidence_rate: 0.08,
      low_confidence_count: 563,
      severity: 'medium',
      distribution: [
        { range: '0.0-0.2', count: 0 },
        { range: '0.2-0.4', count: 57 },
        { range: '0.4-0.6', count: 506 },
        { range: '0.6-0.8', count: 1593 },
        { range: '0.8-1.0', count: 4887 },
      ],
    },
  },
  recommendations: [
    {
      code: 'drift_retrain',
      title: 'Concept/Data Drift Detected',
      severity: 'high',
      risk_score: 78,
      rationale: 'Production feature distributions have moved away from the baseline dataset.',
      recommended_action: 'Retrain the model on fresher data and review feature drift drivers.',
      auto_fix_available: true,
    },
    {
      code: 'quality_cleanup',
      title: 'Dataset Quality Degradation',
      severity: 'medium',
      risk_score: 32,
      rationale: 'Missing values and outliers are reducing training readiness.',
      recommended_action: 'Apply preprocessing cleanup before retraining.',
      auto_fix_available: true,
    },
    {
      code: 'bias_rebalance',
      title: 'Fairness Risk Detected',
      severity: 'medium',
      risk_score: 44,
      rationale: 'Protected-group outcome parity has fallen outside the accepted threshold.',
      recommended_action: 'Rebalance the training sample and validate post-fix fairness.',
      auto_fix_available: false,
    },
  ],
  recommendation_text: [
    'Retrain the model on fresher data and review feature drift drivers.',
    'Apply preprocessing cleanup before retraining.',
    'Rebalance the training sample and validate post-fix fairness.',
  ],
  insights: {
    provider: 'rule-based',
    model: 'local-fallback',
    text: 'Model drift is elevated because recent applicant behavior differs from the baseline cohort, especially across income-related features. Fairness gaps remain visible across gender and income bands, while anomaly levels and low-confidence predictions suggest more human review is needed before wide rollout. Recommended governance action: retrain on fresher balanced data, validate fairness before promotion, and keep auto-fix behind approval until the new model closes the risk gap.',
  },
  charts: {
    feature_importance: [
      { feature: 'tenure', importance: 0.231 },
      { feature: 'MonthlyCharges', importance: 0.198 },
      { feature: 'TotalCharges', importance: 0.187 },
      { feature: 'Contract', importance: 0.143 },
    ],
  },
  governance_report: null,
  auto_fix: {
    available_count: 2,
    last_run: null,
  },
  pipeline: [
    { step: 'Detection', status: 'completed', time: '10:03' },
    { step: 'Explanation', status: 'completed', time: '10:05' },
    { step: 'Recommendation', status: 'completed', time: '10:06' },
    { step: 'Auto-Fix', status: 'standby', time: 'Awaiting approval' },
  ],
  generated_at: new Date().toISOString(),
}
