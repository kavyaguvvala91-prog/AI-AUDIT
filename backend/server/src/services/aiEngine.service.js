const aiClient = require("../config/axios");

const call = async (method, url, payload) => {
  try {
    const response =
      method === "get"
        ? await aiClient.get(url, payload)
        : await aiClient[method](url, payload);
    return response.data;
  } catch (err) {
    if (!err.response) {
      err.message = `AI engine is unreachable at ${process.env.AI_ENGINE_BASE_URL}${url}`;
    }
    throw err;
  }
};

const analyseDataset = (filePath, columns) =>
  call("post", "/analyse", { file_path: filePath, columns });

const runAutoML = (filePath, targetColumn, config = {}) =>
  call("post", "/automl", { file_path: filePath, target_column: targetColumn, config });

const runPredictions = (filePath, modelId) =>
  call("post", "/predict", { file_path: filePath, model_id: modelId });

const detectDrift = (currentFilePath, referenceFilePath) =>
  call("post", "/drift", {
    current_file_path: currentFilePath,
    reference_file_path: referenceFilePath,
  });

const auditBias = (filePath, targetColumn, sensitiveAttrs) =>
  call("post", "/bias", {
    file_path: filePath,
    target_column: targetColumn,
    sensitive_attributes: sensitiveAttrs,
  });

const detectAnomalies = (filePath, columns) =>
  call("post", "/anomaly", { file_path: filePath, columns });

const getQualityReport = (filePath) =>
  call("get", "/quality", { params: { file_path: filePath } });

const explainPrediction = (filePath, modelId, rowIndex = 0, topN = 5) =>
  call("post", "/explanations", {
    file_path: filePath,
    model_id: modelId,
    row_index: rowIndex,
    top_n: topN,
  });

const retrainModel = (filePath, targetColumn, currentModelId, driftScore, config = {}) =>
  call("post", "/retrain", {
    file_path: filePath,
    target_column: targetColumn,
    current_model_id: currentModelId,
    drift_score: driftScore,
    config,
  });

const simulateRealtime = ({
  filePath,
  modelId,
  cursor = 0,
  batchSize = 20,
  referenceFilePath,
  targetColumn,
  sensitiveAttributes = [],
}) =>
  call("post", "/simulate", {
    file_path: filePath,
    model_id: modelId,
    cursor,
    batch_size: batchSize,
    reference_file_path: referenceFilePath,
    target_column: targetColumn,
    sensitive_attributes: sensitiveAttributes,
  });

const getRemediationRecommendations = (monitoringContext, qualityContext = {}, explanationContext = {}, trainingContext = {}, preferredProvider) =>
  call("post", "/remediation/recommend", {
    monitoring_context: monitoringContext,
    quality_context: qualityContext,
    explanation_context: explanationContext,
    training_context: trainingContext,
    preferred_provider: preferredProvider,
  });

const runAutoFix = (filePath, targetColumn, currentModelId, monitoringContext, qualityContext = {}, trainingContext = {}, approvalGranted = false, config = {}) =>
  call("post", "/remediation/autofix", {
    file_path: filePath,
    target_column: targetColumn,
    current_model_id: currentModelId,
    monitoring_context: monitoringContext,
    quality_context: qualityContext,
    training_context: trainingContext,
    approval_granted: approvalGranted,
    config,
  });

const validateRollback = (targetModelId, targetVersion) =>
  call("post", "/model/rollback", {
    target_model_id: targetModelId,
    target_version: targetVersion,
  });

const generateGovernanceInsights = (context, preferredProvider) =>
  call("post", "/insights/generate", {
    context,
    preferred_provider: preferredProvider,
  });

const downloadGovernanceReport = async (requestBody, format = "json") => {
  try {
    const response = await aiClient.post(`/governance/report?format=${format}`, requestBody, {
      responseType: "arraybuffer",
    });
    return {
      buffer: Buffer.from(response.data),
      contentType: response.headers["content-type"],
    };
  } catch (err) {
    if (!err.response) {
      err.message = `AI engine is unreachable at ${process.env.AI_ENGINE_BASE_URL}/governance/report`;
    }
    throw err;
  }
};

module.exports = {
  analyseDataset,
  runAutoML,
  runPredictions,
  detectDrift,
  auditBias,
  detectAnomalies,
  getQualityReport,
  explainPrediction,
  retrainModel,
  simulateRealtime,
  getRemediationRecommendations,
  runAutoFix,
  validateRollback,
  generateGovernanceInsights,
  downloadGovernanceReport,
};
