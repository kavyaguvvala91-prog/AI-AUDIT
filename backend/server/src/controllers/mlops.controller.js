const datasetService = require("../services/dataset.service");
const aiEngineService = require("../services/aiEngine.service");
const insightService = require("../services/insight.service");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const SENSITIVE_ATTRIBUTE_PRIORITY = [
  { label: "gender", patterns: ["gender", "sex"] },
  { label: "income", patterns: ["income", "salary", "wage", "earnings", "income_band"] },
  { label: "age", patterns: ["age", "age_group", "age_band"] },
  { label: "race", patterns: ["race", "ethnicity", "ethnic"] },
  { label: "region", patterns: ["region", "state", "country", "zip", "zipcode", "postal"] },
];

const extractData = (payload) => payload?.data || {};
const extractNestedPayload = (job) => extractData(job?.payload);
const normalizeKey = (value = "") => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
const isCompletedJob = (job) => job?.status === "completed" && Boolean(job?.payload);

const buildPredictionConfidenceSummary = (predictionPayload = {}) => {
  const predictions = predictionPayload.predictions || [];
  const confidenceValues = predictions
    .map((row) => row?.confidence)
    .filter((value) => typeof value === "number");

  if (!confidenceValues.length) return null;

  const lowConfidenceThreshold = 0.6;
  const lowConfidenceCount = confidenceValues.filter((value) => value < lowConfidenceThreshold).length;

  return {
    average_confidence: Number(
      (confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(4)
    ),
    min_confidence: Number(Math.min(...confidenceValues).toFixed(4)),
    max_confidence: Number(Math.max(...confidenceValues).toFixed(4)),
    low_confidence_count: lowConfidenceCount,
    low_confidence_rate: Number((lowConfidenceCount / confidenceValues.length).toFixed(4)),
    low_confidence_alert: lowConfidenceCount / confidenceValues.length >= 0.15,
  };
};

const resolveModelContext = (dataset) => {
  const currentModelId =
    dataset.currentModel?.modelId ||
    dataset.automl?.payload?.data?.model_id ||
    null;

  return {
    modelId: currentModelId,
    targetColumn:
      dataset.targetColumn ||
      dataset.currentModel?.targetColumn ||
      dataset.automl?.payload?.data?.target_column ||
      null,
  };
};

const buildGovernanceContext = (dataset) => ({
  monitoring_context: {
    drift: extractNestedPayload(dataset.drift),
    bias: extractNestedPayload(dataset.bias),
    anomaly: extractNestedPayload(dataset.anomaly),
    confidence_summary:
      buildPredictionConfidenceSummary(extractNestedPayload(dataset.predictions)) ||
      extractNestedPayload(dataset.simulation)?.summary ||
      null,
  },
  quality_context: extractNestedPayload(dataset.quality),
  explanation_context: extractNestedPayload(dataset.explanations),
  training_context: buildTrainingContext(dataset),
});

function buildTrainingContext(dataset) {
  const automlPayload = extractData(dataset.automl?.payload);
  const metrics = automlPayload.metrics || {};
  const leaderboard = metrics.leaderboard || [];
  const currentModel = dataset.currentModel || {};
  const trainAccuracy = metrics.train_accuracy ?? null;
  const validationAccuracy = metrics.accuracy ?? null;
  const overfittingScore =
    typeof trainAccuracy === "number" && typeof validationAccuracy === "number"
      ? Number((trainAccuracy - validationAccuracy).toFixed(4))
      : null;

  return {
    model_id: automlPayload.model_id || currentModel.modelId || null,
    model_type: metrics.model_type || currentModel.modelType || null,
    problem_type: metrics.problem_type || null,
    leaderboard,
    feature_importance: metrics.feature_importance || {},
    train_accuracy: trainAccuracy,
    validation_accuracy: validationAccuracy,
    overfitting_score: overfittingScore,
    target_column: automlPayload.target_column || dataset.targetColumn || currentModel.targetColumn || null,
  };
}

const formatTrendLabel = (value, fallback) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const severityFromScore = (value, mediumThreshold, highThreshold) => {
  if (value >= highThreshold) return "high";
  if (value >= mediumThreshold) return "medium";
  return "low";
};

const inferTargetColumn = (dataset) =>
  resolveModelContext(dataset).targetColumn ||
  extractData(dataset.analysis?.payload).suggested_target ||
  dataset.columns?.[dataset.columns.length - 1] ||
  null;

const inferSensitiveAttributes = (columns = [], targetColumn, requested = []) => {
  const normalizedTarget = normalizeKey(targetColumn);
  const available = new Map(columns.map((column) => [normalizeKey(column), column]));

  if (Array.isArray(requested) && requested.length > 0) {
    return requested
      .map((column) => available.get(normalizeKey(column)))
      .filter((column, index, list) => column && normalizeKey(column) !== normalizedTarget && list.indexOf(column) === index);
  }

  const matches = [];
  for (const priority of SENSITIVE_ATTRIBUTE_PRIORITY) {
    for (const [normalized, original] of available.entries()) {
      if (normalized === normalizedTarget) continue;
      if (priority.patterns.some((pattern) => normalized.includes(pattern))) {
        matches.push(original);
      }
    }
  }

  return matches.filter((column, index) => matches.indexOf(column) === index).slice(0, 3);
};

const buildConfidenceDistribution = (predictionPayload = {}) => {
  const buckets = [
    { range: "0.0-0.2", min: 0, max: 0.2, count: 0 },
    { range: "0.2-0.4", min: 0.2, max: 0.4, count: 0 },
    { range: "0.4-0.6", min: 0.4, max: 0.6, count: 0 },
    { range: "0.6-0.8", min: 0.6, max: 0.8, count: 0 },
    { range: "0.8-1.0", min: 0.8, max: 1.000001, count: 0 },
  ];

  for (const row of predictionPayload.predictions || []) {
    if (typeof row?.confidence !== "number") continue;
    const bucket = buckets.find((item) => row.confidence >= item.min && row.confidence < item.max);
    if (bucket) bucket.count += 1;
  }

  return buckets.map(({ range, count }) => ({ range, count }));
};

const buildFeatureImportance = (dataset) =>
  Object.entries(extractData(dataset.automl?.payload).metrics?.feature_importance || {})
    .map(([feature, importance]) => ({ feature, importance: Number(importance) }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 8);

const buildFairnessHeatmap = (groupSummary = {}) =>
  Object.entries(groupSummary).flatMap(([attribute, rows]) =>
    (rows || []).map((row) => ({
      attribute,
      group: row.group,
      count: row.count,
      parity_gap: row.parity_gap,
      positive_rate: row.positive_rate,
      severity: row.severity,
    }))
  );

const buildDriftTrend = (dataset, currentScore) => {
  const history = (dataset.retrainingHistory || [])
    .filter((entry) => typeof entry.driftScore === "number")
    .slice(-4)
    .map((entry) => ({
      label: formatTrendLabel(entry.createdAt, "Previous"),
      score: Number(entry.driftScore.toFixed(4)),
    }));

  if (typeof currentScore === "number") {
    history.push({
      label: formatTrendLabel(dataset.drift?.completed_at || new Date().toISOString(), "Latest"),
      score: Number(currentScore.toFixed(4)),
    });
  }

  if (!history.length && typeof currentScore === "number") {
    history.push({ label: "Latest", score: Number(currentScore.toFixed(4)) });
  }

  return history;
};

const buildAnomalyTrend = (dataset, anomalyRate, anomalyCount) => {
  if (typeof anomalyRate !== "number") return [];
  return [
    {
      label: formatTrendLabel(dataset.anomaly?.completed_at || new Date().toISOString(), "Latest"),
      rate: Number(anomalyRate.toFixed(4)),
      count: anomalyCount || 0,
    },
  ];
};

const buildSuspiciousPredictions = (predictionPayload = {}, anomalyPayload = {}) => {
  const anomalyIndices = new Set(anomalyPayload.anomaly_indices || []);

  return (predictionPayload.predictions || [])
    .filter((row) => anomalyIndices.has(row.row_index) || (typeof row.confidence === "number" && row.confidence < 0.6))
    .sort((left, right) => (left.confidence ?? 1) - (right.confidence ?? 1))
    .slice(0, 6)
    .map((row) => ({
      row_index: row.row_index,
      prediction: row.prediction,
      confidence: row.confidence ?? null,
      flagged_as_anomaly: anomalyIndices.has(row.row_index),
    }));
};

const buildGovernanceTimeline = (dataset, hasInsights, hasRecommendations) => [
  {
    step: "Detection",
    status: dataset.anomaly?.payload || dataset.bias?.payload || dataset.drift?.payload ? "completed" : "pending",
    time: dataset.anomaly?.completed_at || dataset.bias?.completed_at || dataset.drift?.completed_at || "Awaiting signals",
  },
  {
    step: "Explanation",
    status: hasInsights ? "completed" : "pending",
    time: hasInsights ? "Live" : "Rule-based standby",
  },
  {
    step: "Recommendation",
    status: hasRecommendations ? "completed" : "pending",
    time: hasRecommendations ? "Live" : "No action required",
  },
  {
    step: "Auto-Fix",
    status: dataset.autoFix?.payload ? "completed" : "standby",
    time: dataset.autoFix?.completed_at || "Manual approval",
  },
];

const buildAlerts = ({ summary, drift, bias, anomaly, confidence, findings = [], warnings = [] }) => {
  const alerts = [];

  if (summary?.severity) {
    alerts.push({
      severity: summary.severity,
      title: `Overall governance risk is ${summary.severity}`,
      detail: `Model health is ${summary.model_health_score}/100 with an overall risk score of ${summary.overall_risk_score}/100.`,
    });
  }

  if (drift?.drifted) {
    alerts.push({
      severity: drift.severity,
      title: "Drift threshold exceeded",
      detail: `Drift score ${drift.score} is above threshold ${drift.threshold}.`,
    });
  }

  if (bias?.bias_detected) {
    alerts.push({
      severity: bias.severity,
      title: "Fairness issue detected",
      detail: `${bias.affected_groups.length} sensitive groups show elevated parity gaps.`,
    });
  }

  if (anomaly?.count > 0) {
    alerts.push({
      severity: anomaly.severity,
      title: "Anomalous records detected",
      detail: `${anomaly.count} rows were flagged as suspicious in the latest scan.`,
    });
  }

  if (confidence?.low_confidence_count > 0) {
    alerts.push({
      severity: confidence.severity,
      title: "Low-confidence predictions need review",
      detail: `${confidence.low_confidence_count} predictions fall below the review threshold.`,
    });
  }

  for (const finding of findings.slice(0, 2)) {
    alerts.push({
      severity: finding.severity,
      title: finding.title,
      detail: finding.recommended_action,
    });
  }

  for (const warning of warnings.slice(0, 2)) {
    alerts.push({
      severity: "warning",
      title: "Coverage gap",
      detail: warning,
    });
  }

  return alerts;
};

const runStoredJob = async (dataset, resultKey, runner) => {
  await datasetService.markAIJobRunning(dataset._id, resultKey);
  try {
    const payload = await runner();
    await datasetService.saveAIResult(dataset._id, resultKey, payload);
  } catch (err) {
    await datasetService.saveAIResult(dataset._id, resultKey, { error: err.message }, "failed");
    throw err;
  }
  return datasetService.getDatasetById(dataset._id);
};

const ensureAnalysisReady = async (dataset, warnings) => {
  if (isCompletedJob(dataset.analysis)) return dataset;
  try {
    return await runStoredJob(dataset, "analysis", () => aiEngineService.analyseDataset(dataset.filePath, dataset.columns));
  } catch (err) {
    warnings.push(`Analysis could not be refreshed: ${err.message}`);
    return datasetService.getDatasetById(dataset._id);
  }
};

const ensureQualityReady = async (dataset, warnings) => {
  if (isCompletedJob(dataset.quality)) return dataset;
  try {
    return await runStoredJob(dataset, "quality", () => aiEngineService.getQualityReport(dataset.filePath));
  } catch (err) {
    warnings.push(`Quality analysis is unavailable: ${err.message}`);
    return datasetService.getDatasetById(dataset._id);
  }
};

const ensureTrainingReady = async (dataset, targetColumn, warnings) => {
  const existingTraining = extractData(dataset.automl?.payload);
  if (isCompletedJob(dataset.automl) && resolveModelContext(dataset).modelId && existingTraining.metrics) return dataset;
  if (!targetColumn) {
    warnings.push("No target column could be inferred, so training-dependent governance signals are limited.");
    return dataset;
  }

  try {
    const refreshed = await runStoredJob(dataset, "automl", () =>
      aiEngineService.runAutoML(dataset.filePath, targetColumn, {})
    );
    const trainingData = extractData(refreshed.automl?.payload);

    if (trainingData?.model_id) {
      await datasetService.updateDatasetFields(refreshed._id, { targetColumn });
      await datasetService.registerModelVersion(refreshed._id, {
        modelId: trainingData.model_id,
        version: trainingData.model_version || "v1",
        parentModelId: trainingData.parent_model_id || null,
        modelType: trainingData.metrics?.model_type || "Unknown",
        problemType: trainingData.metrics?.problem_type || "unknown",
        targetColumn,
        metrics: trainingData.metrics || {},
        leaderboard: trainingData.metrics?.leaderboard || [],
        createdAt: new Date(),
        source: "training",
      });
    }

    return datasetService.getDatasetById(dataset._id);
  } catch (err) {
    warnings.push(`Model training could not be refreshed: ${err.message}`);
    return datasetService.getDatasetById(dataset._id);
  }
};

const ensurePredictionsReady = async (dataset, modelId, warnings) => {
  if (isCompletedJob(dataset.predictions) || !modelId) {
    if (!modelId) warnings.push("Predictions are unavailable because no trained model is active yet.");
    return dataset;
  }

  try {
    return await runStoredJob(dataset, "predictions", () => aiEngineService.runPredictions(dataset.filePath, modelId));
  } catch (err) {
    warnings.push(`Prediction confidence could not be refreshed: ${err.message}`);
    return datasetService.getDatasetById(dataset._id);
  }
};

const ensureAnomalyReady = async (dataset, warnings) => {
  if (isCompletedJob(dataset.anomaly)) return dataset;
  try {
    return await runStoredJob(dataset, "anomaly", () => aiEngineService.detectAnomalies(dataset.filePath, dataset.columns));
  } catch (err) {
    warnings.push(`Anomaly detection is unavailable: ${err.message}`);
    return datasetService.getDatasetById(dataset._id);
  }
};

const ensureBiasReady = async (dataset, targetColumn, sensitiveAttributes, warnings) => {
  if (isCompletedJob(dataset.bias)) return dataset;
  if (!targetColumn || !sensitiveAttributes.length) {
    warnings.push("Bias analysis needs a target column plus sensitive attributes such as gender or income.");
    return dataset;
  }

  try {
    return await runStoredJob(dataset, "bias", () =>
      aiEngineService.auditBias(dataset.filePath, targetColumn, sensitiveAttributes)
    );
  } catch (err) {
    warnings.push(`Bias analysis is unavailable: ${err.message}`);
    return datasetService.getDatasetById(dataset._id);
  }
};

const ensureDriftReady = async (dataset, referenceDatasetId, warnings) => {
  if (!referenceDatasetId) {
    if (!isCompletedJob(dataset.drift)) {
      warnings.push("Drift trend is limited until a reference dataset is selected for comparison.");
    }
    return dataset;
  }

  try {
    const referenceDataset = await datasetService.getDatasetById(referenceDatasetId);
    return await runStoredJob(dataset, "drift", () =>
      aiEngineService.detectDrift(dataset.filePath, referenceDataset.filePath)
    );
  } catch (err) {
    warnings.push(`Drift comparison could not be refreshed: ${err.message}`);
    return datasetService.getDatasetById(dataset._id);
  }
};

const buildGovernanceDashboardPayload = (dataset, remediation, insights, options = {}) => {
  const report = remediation.governance_report || {};
  const summary = remediation.summary || {};
  const driftMetrics = report.drift_summary?.metrics || {};
  const fairnessMetrics = report.fairness_summary?.metrics || {};
  const anomalyMetrics = report.anomaly_summary?.metrics || {};
  const confidenceMetrics = report.confidence_analysis?.metrics || {};
  const predictionPayload = extractData(dataset.predictions?.payload);
  const driftScore = Number(driftMetrics.drift_score || 0);
  const fairnessScore = Number(fairnessMetrics.fairness_score || 0);
  const anomalyRate = Number(anomalyMetrics.anomaly_rate || 0);
  const lowConfidenceRate = Number(confidenceMetrics.low_confidence_rate || 0);
  const driftFeatures = Object.entries(driftMetrics.top_columns || {})
    .map(([feature, score]) => ({ feature, score: Number(score) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
  const fairnessHeatmap = buildFairnessHeatmap(fairnessMetrics.group_summary || {});
  const suspiciousPredictions = buildSuspiciousPredictions(predictionPayload, extractNestedPayload(dataset.anomaly));

  const monitoring = {
    drift: {
      score: driftScore,
      threshold: Number(driftMetrics.threshold || 0.2),
      drifted: Boolean(driftScore >= Number(driftMetrics.threshold || 0.2)),
      severity: severityFromScore(driftScore, 0.1, 0.2),
      affected_features: driftFeatures,
      trend: buildDriftTrend(dataset, driftScore),
      reference_dataset_id: options.referenceDatasetId || null,
    },
    bias: {
      bias_detected: Boolean(fairnessMetrics.bias_detected),
      fairness_score: fairnessScore,
      severity: fairnessMetrics.bias_severity || severityFromScore(1 - fairnessScore, 0.08, 0.18),
      sensitive_attributes: options.sensitiveAttributes || [],
      affected_groups: fairnessHeatmap.filter((item) => (item.parity_gap || 0) >= 0.1),
      heatmap: fairnessHeatmap,
    },
    anomaly: {
      count: anomalyMetrics.total_anomalies || 0,
      rate: anomalyRate,
      severity: severityFromScore(anomalyRate, 0.03, 0.1),
      sample_indices: anomalyMetrics.sample_indices || [],
      suspicious_predictions: suspiciousPredictions,
      trend: buildAnomalyTrend(dataset, anomalyRate, anomalyMetrics.total_anomalies || 0),
    },
    confidence: {
      average: Number(confidenceMetrics.average_confidence || 0),
      min: confidenceMetrics.min_confidence ?? null,
      max: confidenceMetrics.max_confidence ?? null,
      low_confidence_rate: lowConfidenceRate,
      low_confidence_count:
        confidenceMetrics.low_confidence_count ??
        Math.max(0, confidenceMetrics.low_confidence_rate ? Math.round(lowConfidenceRate * (predictionPayload.total_rows || 0)) : 0),
      severity: severityFromScore(lowConfidenceRate, 0.08, 0.18),
      distribution: buildConfidenceDistribution(predictionPayload),
    },
  };

  return {
    dataset: {
      id: String(dataset._id),
      name: dataset.name,
      rows: dataset.rowCount,
      columns: dataset.columnCount,
      target_column: options.targetColumn,
      model_id: resolveModelContext(dataset).modelId,
      model_type: buildTrainingContext(dataset).model_type,
      sensitive_attributes: options.sensitiveAttributes || [],
      reference_dataset_id: options.referenceDatasetId || null,
    },
    summary: {
      ...summary,
      risk_level: summary.severity || "low",
    },
    alerts: buildAlerts({
      summary,
      drift: monitoring.drift,
      bias: monitoring.bias,
      anomaly: monitoring.anomaly,
      confidence: monitoring.confidence,
      findings: remediation.findings || [],
      warnings: options.warnings || [],
    }),
    warnings: options.warnings || [],
    monitoring,
    recommendations: remediation.findings || [],
    recommendation_text: remediation.recommendations || [],
    insights: insights,
    charts: {
      feature_importance: buildFeatureImportance(dataset),
    },
    governance_report: remediation.governance_report || null,
    auto_fix: {
      available_count: (remediation.findings || []).filter((item) => item.auto_fix_available).length,
      last_run: extractData(dataset.autoFix?.payload),
    },
    pipeline: buildGovernanceTimeline(dataset, Boolean(insights?.text), (remediation.findings || []).length > 0),
    generated_at: new Date().toISOString(),
  };
};

const runQualityAnalysis = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  await datasetService.markAIJobRunning(dataset._id, "quality");

  try {
    const quality = await aiEngineService.getQualityReport(dataset.filePath);
    const updated = await datasetService.saveAIResult(dataset._id, "quality", quality);
    return sendSuccess(res, {
      message: "Data quality analysis completed",
      data: { datasetId: updated._id, quality: updated.quality },
    });
  } catch (err) {
    await datasetService.saveAIResult(dataset._id, "quality", { error: err.message }, "failed");
    throw err;
  }
};

const runExplainability = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  const { modelId, targetColumn } = resolveModelContext(dataset);
  if (!modelId) {
    return sendError(res, {
      statusCode: 400,
      message: "No active model found. Train a model before generating explanations.",
      error: "MISSING_MODEL_ID",
    });
  }

  await datasetService.markAIJobRunning(dataset._id, "explanations");

  try {
    const explanation = await aiEngineService.explainPrediction(
      dataset.filePath,
      modelId,
      req.body.rowIndex || 0,
      req.body.topN || 5
    );
    const updated = await datasetService.saveAIResult(dataset._id, "explanations", {
      ...explanation,
      meta: { modelId, targetColumn },
    });
    return sendSuccess(res, {
      message: "Explainability report completed",
      data: { datasetId: updated._id, explanations: updated.explanations },
    });
  } catch (err) {
    await datasetService.saveAIResult(dataset._id, "explanations", { error: err.message }, "failed");
    throw err;
  }
};

const runRetraining = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  const { modelId, targetColumn } = resolveModelContext(dataset);
  const driftScore = req.body.driftScore ?? dataset.drift?.payload?.data?.drift_score;
  const resolvedTargetColumn = req.body.targetColumn || targetColumn;

  if (!resolvedTargetColumn) {
    return sendError(res, {
      statusCode: 400,
      message: "targetColumn is required to retrain the model.",
      error: "MISSING_TARGET_COLUMN",
    });
  }

  await datasetService.markAIJobRunning(dataset._id, "retraining");

  try {
    const retraining = await aiEngineService.retrainModel(
      dataset.filePath,
      resolvedTargetColumn,
      modelId,
      driftScore,
      req.body.config || {}
    );

    const updated = await datasetService.saveAIResult(dataset._id, "retraining", retraining);
    const retrainData = extractData(retraining);

    if (retrainData.triggered && retrainData.training_result?.model_id) {
      await datasetService.registerModelVersion(dataset._id, {
        modelId: retrainData.training_result.model_id,
        version: retrainData.training_result.model_version || retrainData.new_version || "v1",
        parentModelId: retrainData.previous_model_id || null,
        modelType: retrainData.training_result.metrics?.model_type || "Unknown",
        problemType: retrainData.training_result.metrics?.problem_type || "unknown",
        targetColumn: retrainData.training_result.target_column || resolvedTargetColumn,
        metrics: retrainData.training_result.metrics || {},
        leaderboard: retrainData.training_result.metrics?.leaderboard || [],
        createdAt: new Date(),
        source: "retraining",
      });

      await datasetService.updateDatasetFields(dataset._id, {
        "automl.status": "completed",
        "automl.completed_at": new Date(),
        "automl.payload": {
          success: true,
          message: "Active model replaced by retraining run",
          data: retrainData.training_result,
        },
      });
    }

    await datasetService.appendRetrainingHistory(dataset._id, {
      triggered: retrainData.triggered,
      reason: retrainData.reason,
      driftScore: retrainData.drift_score,
      threshold: retrainData.threshold,
      previousModelId: retrainData.previous_model_id,
      newModelId: retrainData.new_model_id,
      previousVersion: retrainData.previous_version,
      newVersion: retrainData.new_version,
      comparison: retrainData.comparison || [],
      createdAt: new Date(),
    });

    return sendSuccess(res, {
      message: "Retraining workflow completed",
      data: {
        datasetId: updated._id,
        retraining: retrainData,
      },
    });
  } catch (err) {
    await datasetService.saveAIResult(dataset._id, "retraining", { error: err.message }, "failed");
    throw err;
  }
};

const getRetrainingStatus = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  return sendSuccess(res, {
    message: "Retraining status retrieved",
    data: {
      currentModel: dataset.currentModel,
      retraining: dataset.retraining,
      modelVersions: dataset.modelVersions,
      retrainingHistory: dataset.retrainingHistory,
      autoRetrainEnabled: dataset.autoRetrainEnabled,
      autoFixHistory: dataset.autoFixHistory,
      rollbackHistory: dataset.rollbackHistory,
    },
  });
};

const getModelComparison = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  const automlData = extractData(dataset.automl?.payload);
  return sendSuccess(res, {
    message: "Model comparison retrieved",
    data: {
      currentModel: dataset.currentModel,
      leaderboard: automlData.metrics?.leaderboard || [],
      bestModel: automlData.metrics?.model_type || dataset.currentModel?.modelType || null,
      versions: dataset.modelVersions,
    },
  });
};

const simulateRealtime = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  const { modelId, targetColumn } = resolveModelContext(dataset);
  if (!modelId) {
    return sendError(res, {
      statusCode: 400,
      message: "No active model found. Train a model before starting realtime simulation.",
      error: "MISSING_MODEL_ID",
    });
  }

  await datasetService.markAIJobRunning(dataset._id, "simulation");

  try {
    const simulation = await aiEngineService.simulateRealtime({
      filePath: dataset.filePath,
      modelId,
      cursor: req.body.cursor || 0,
      batchSize: req.body.batchSize || 20,
      referenceFilePath: req.body.referenceDatasetId
        ? (await datasetService.getDatasetById(req.body.referenceDatasetId)).filePath
        : null,
      targetColumn,
      sensitiveAttributes: req.body.sensitiveAttributes || [],
    });
    const updated = await datasetService.saveAIResult(dataset._id, "simulation", simulation);
    return sendSuccess(res, {
      message: "Realtime simulation batch generated",
      data: { datasetId: updated._id, simulation: updated.simulation },
    });
  } catch (err) {
    await datasetService.saveAIResult(dataset._id, "simulation", { error: err.message }, "failed");
    throw err;
  }
};

const getFairnessDashboard = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  return sendSuccess(res, {
    message: "Fairness dashboard data retrieved",
    data: extractData(dataset.bias?.payload),
  });
};

const generateInsights = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  const context = {
    dataset: {
      id: dataset._id,
      name: dataset.name,
      rows: dataset.rowCount,
      columns: dataset.columns,
      targetColumn: dataset.targetColumn,
    },
    quality: extractData(dataset.quality?.payload),
    drift: extractData(dataset.drift?.payload),
    bias: extractData(dataset.bias?.payload),
    retraining: extractData(dataset.retraining?.payload),
    explanations: extractData(dataset.explanations?.payload),
    currentModel: dataset.currentModel,
  };

  const insights = await insightService.generateInsights(context, req.body.preferredProvider);
  return sendSuccess(res, {
    message: "AI insights generated",
    data: insights,
  });
};

const getRemediationRecommendations = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  await datasetService.markAIJobRunning(dataset._id, "remediation");

  try {
    const context = buildGovernanceContext(dataset);
    const recommendations = await aiEngineService.getRemediationRecommendations(
      context.monitoring_context,
      context.quality_context,
      context.explanation_context,
      context.training_context,
      req.body.preferredProvider
    );
    const updated = await datasetService.saveAIResult(dataset._id, "remediation", recommendations);
    return sendSuccess(res, {
      message: "Remediation recommendations generated",
      data: { datasetId: updated._id, remediation: updated.remediation },
    });
  } catch (err) {
    await datasetService.saveAIResult(dataset._id, "remediation", { error: err.message }, "failed");
    throw err;
  }
};

const runAutoFix = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  const { modelId, targetColumn } = resolveModelContext(dataset);
  const resolvedTargetColumn = req.body.targetColumn || targetColumn;

  if (!resolvedTargetColumn) {
    return sendError(res, {
      statusCode: 400,
      message: "targetColumn is required for auto-fix mode.",
      error: "MISSING_TARGET_COLUMN",
    });
  }

  await datasetService.markAIJobRunning(dataset._id, "autoFix");

  try {
    const context = buildGovernanceContext(dataset);
    const autoFix = await aiEngineService.runAutoFix(
      dataset.filePath,
      resolvedTargetColumn,
      modelId,
      context.monitoring_context,
      context.quality_context,
      context.training_context,
      Boolean(req.body.approvalGranted),
      req.body.config || {}
    );

    const updated = await datasetService.saveAIResult(dataset._id, "autoFix", autoFix);
    const fixData = extractData(autoFix);
    const retraining = fixData.retraining;

    await datasetService.appendAutoFixHistory(dataset._id, {
      createdAt: new Date(),
      approvalGranted: Boolean(req.body.approvalGranted),
      executed: Boolean(fixData.executed),
      preparedDatasetPath: fixData.prepared_dataset_path || null,
      rollbackVersion: fixData.rollback_version || null,
      rollbackTargetModelId: fixData.rollback_target_model_id || null,
      retrainingTriggered: Boolean(retraining?.triggered),
      executionLogs: fixData.execution_logs || [],
      actions: fixData.actions || [],
    });

    if (retraining?.triggered && retraining.training_result?.model_id) {
      await datasetService.registerModelVersion(dataset._id, {
        modelId: retraining.training_result.model_id,
        version: retraining.training_result.model_version || retraining.new_version || "v1",
        parentModelId: retraining.previous_model_id || null,
        modelType: retraining.training_result.metrics?.model_type || "Unknown",
        problemType: retraining.training_result.metrics?.problem_type || "unknown",
        targetColumn: retraining.training_result.target_column || resolvedTargetColumn,
        metrics: retraining.training_result.metrics || {},
        leaderboard: retraining.training_result.metrics?.leaderboard || [],
        createdAt: new Date(),
        source: "auto-fix",
      });

      await datasetService.updateDatasetFields(dataset._id, {
        "automl.status": "completed",
        "automl.completed_at": new Date(),
        "automl.payload": {
          success: true,
          message: "Active model replaced by auto-fix retraining run",
          data: retraining.training_result,
        },
      });

      await datasetService.appendRetrainingHistory(dataset._id, {
        triggered: retraining.triggered,
        reason: retraining.reason,
        driftScore: retraining.drift_score,
        threshold: retraining.threshold,
        previousModelId: retraining.previous_model_id,
        newModelId: retraining.new_model_id,
        previousVersion: retraining.previous_version,
        newVersion: retraining.new_version,
        comparison: retraining.comparison || [],
        createdAt: new Date(),
      });
    }

    return sendSuccess(res, {
      message: "Auto-fix flow completed",
      data: { datasetId: updated._id, autoFix: updated.autoFix },
    });
  } catch (err) {
    await datasetService.saveAIResult(dataset._id, "autoFix", { error: err.message }, "failed");
    throw err;
  }
};

const rollbackModel = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  const version = dataset.modelVersions.find((item) =>
    item.modelId === req.body.targetModelId || item.version === req.body.targetVersion
  );

  if (!version) {
    return sendError(res, {
      statusCode: 404,
      message: "Requested rollback target was not found in model history.",
      error: "ROLLBACK_TARGET_NOT_FOUND",
    });
  }

  await aiEngineService.validateRollback(version.modelId, version.version);
  await datasetService.updateDatasetFields(dataset._id, {
    currentModel: {
      modelId: version.modelId,
      version: version.version,
      modelType: version.modelType,
      targetColumn: version.targetColumn,
      trainedAt: version.createdAt || new Date(),
    },
  });
  await datasetService.appendRollbackHistory(dataset._id, {
    previousModelId: dataset.currentModel?.modelId || null,
    previousVersion: dataset.currentModel?.version || null,
    rolledBackToModelId: version.modelId,
    rolledBackToVersion: version.version,
    createdAt: new Date(),
  });

  return sendSuccess(res, {
    message: "Model rollback completed",
    data: {
      currentModel: {
        modelId: version.modelId,
        version: version.version,
        modelType: version.modelType,
      },
    },
  });
};

const downloadGovernanceReport = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  await datasetService.markAIJobRunning(dataset._id, "governance");

  try {
    const context = buildGovernanceContext(dataset);
    const requestBody = {
      monitoring_context: context.monitoring_context,
      quality_context: context.quality_context,
      explanation_context: context.explanation_context,
      training_context: context.training_context,
      preferred_provider: req.body.preferredProvider,
    };
    const format = req.query.format === "pdf" ? "pdf" : "json";
    const reportFile = await aiEngineService.downloadGovernanceReport(requestBody, format);

    await datasetService.saveAIResult(dataset._id, "governance", {
      generatedAt: new Date().toISOString(),
      format,
      preferredProvider: req.body.preferredProvider || null,
      summarySource: requestBody,
    });

    res.setHeader("Content-Type", reportFile.contentType || (format === "pdf" ? "application/pdf" : "application/json"));
    res.setHeader("Content-Disposition", `attachment; filename="governance-report-${dataset._id}.${format}"`);
    return res.send(reportFile.buffer);
  } catch (err) {
    await datasetService.saveAIResult(dataset._id, "governance", { error: err.message }, "failed");
    throw err;
  }
};

const generateGovernanceInsights = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  const context = {
    dataset: {
      id: dataset._id,
      name: dataset.name,
      rows: dataset.rowCount,
      columns: dataset.columns,
      targetColumn: dataset.targetColumn,
    },
    ...buildGovernanceContext(dataset),
    currentModel: dataset.currentModel,
  };

  const insights = await aiEngineService.generateGovernanceInsights(context, req.body.preferredProvider);
  return sendSuccess(res, {
    message: "Governance insights generated",
    data: insights,
  });
};

const buildGovernanceDashboardForDataset = async (datasetId, requestBody = {}) => {
  const warnings = [];
  let dataset = await datasetService.getDatasetById(datasetId);

  dataset = await ensureAnalysisReady(dataset, warnings);

  const targetColumn = requestBody.targetColumn || inferTargetColumn(dataset);
  const sensitiveAttributes = inferSensitiveAttributes(
    dataset.columns || [],
    targetColumn,
    requestBody.sensitiveAttributes || []
  );

  dataset = await ensureTrainingReady(dataset, targetColumn, warnings);
  const { modelId } = resolveModelContext(dataset);
  dataset = await ensureQualityReady(dataset, warnings);
  dataset = await ensurePredictionsReady(dataset, modelId, warnings);
  dataset = await ensureAnomalyReady(dataset, warnings);
  dataset = await ensureBiasReady(dataset, targetColumn, sensitiveAttributes, warnings);
  dataset = await ensureDriftReady(dataset, requestBody.referenceDatasetId, warnings);

  const context = buildGovernanceContext(dataset);
  const remediationEnvelope = await aiEngineService.getRemediationRecommendations(
    context.monitoring_context,
    context.quality_context,
    context.explanation_context,
    context.training_context,
    requestBody.preferredProvider
  );
  const remediation = extractData(remediationEnvelope);
  const insights = await aiEngineService.generateGovernanceInsights(
    {
      dataset: {
        id: dataset._id,
        name: dataset.name,
        rows: dataset.rowCount,
        columns: dataset.columns,
        targetColumn,
      },
      ...context,
      findings: remediation.findings || [],
      warnings,
      sensitive_attributes: sensitiveAttributes,
    },
    requestBody.preferredProvider
  );

  const dashboard = buildGovernanceDashboardPayload(dataset, remediation, insights, {
    targetColumn,
    sensitiveAttributes,
    referenceDatasetId: requestBody.referenceDatasetId || null,
    warnings,
  });

  await datasetService.saveAIResult(dataset._id, "remediation", remediationEnvelope);
  await datasetService.saveAIResult(dataset._id, "governance", {
    generatedAt: dashboard.generated_at,
    summary: dashboard.summary,
    insights,
    warnings,
  });

  return dashboard;
};

const getGovernanceDashboard = async (req, res) => {
  const dashboard = await buildGovernanceDashboardForDataset(req.params.id, req.body || {});
  return sendSuccess(res, {
    message: "Governance dashboard generated",
    data: dashboard,
  });
};

module.exports = {
  runQualityAnalysis,
  runExplainability,
  runRetraining,
  getRetrainingStatus,
  getModelComparison,
  simulateRealtime,
  getFairnessDashboard,
  generateInsights,
  getRemediationRecommendations,
  runAutoFix,
  rollbackModel,
  downloadGovernanceReport,
  generateGovernanceInsights,
  getGovernanceDashboard,
  buildGovernanceDashboardForDataset,
};
