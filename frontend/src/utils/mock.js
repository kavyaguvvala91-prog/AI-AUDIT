// Mock data for demo / fallback when backend is not connected

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
  model_type: 'Random Forest Classifier',
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
}

export const mockMonitoring = {
  drift_score: 0.14,
  drift_status: 'Low',
  anomaly_count: 23,
  anomaly_rate: 0.0033,
  confidence_mean: 0.832,
  confidence_std: 0.094,
  bias_score: 0.07,
  bias_features: ['gender', 'SeniorCitizen'],
  feature_importance: [
    { feature: 'tenure', importance: 0.231 },
    { feature: 'MonthlyCharges', importance: 0.198 },
    { feature: 'TotalCharges', importance: 0.187 },
    { feature: 'Contract', importance: 0.143 },
    { feature: 'PaymentMethod', importance: 0.091 },
    { feature: 'InternetService', importance: 0.073 },
    { feature: 'OnlineSecurity', importance: 0.042 },
    { feature: 'TechSupport', importance: 0.035 },
  ],
  drift_history: [
    { day: 'Day 1', score: 0.04 },
    { day: 'Day 2', score: 0.06 },
    { day: 'Day 3', score: 0.09 },
    { day: 'Day 4', score: 0.11 },
    { day: 'Day 5', score: 0.14 },
    { day: 'Day 6', score: 0.13 },
    { day: 'Day 7', score: 0.14 },
  ],
  confidence_dist: [
    { range: '0.5-0.6', count: 142 },
    { range: '0.6-0.7', count: 389 },
    { range: '0.7-0.8', count: 1204 },
    { range: '0.8-0.9', count: 2871 },
    { range: '0.9-1.0', count: 2437 },
  ],
}
