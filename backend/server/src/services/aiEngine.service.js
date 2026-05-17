const fs = require("fs");
const path = require("path");

const aiClient = require("../config/axios");

const resolveAiEngineUrl = () =>
  (process.env.AI_ENGINE_URL || process.env.AI_ENGINE_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const call = async (method, url, payload) => {
  try {
    const response =
      method === "get"
        ? await aiClient.get(url, payload)
        : await aiClient[method](url, payload);
    return response.data;
  } catch (err) {
    if (!err.response) {
      err.message = `AI engine is unreachable at ${resolveAiEngineUrl()}${url}`;
    }
    throw err;
  }
};

const uploadFileToAiEngine = async (filePath) => {
  if (!filePath) return filePath;

  const localPath = path.normalize(filePath);
  if (!fs.existsSync(localPath)) {
    const err = new Error(`Local file not found for AI upload: ${localPath}`);
    err.statusCode = 404;
    throw err;
  }

  const form = new FormData();
  const buffer = await fs.promises.readFile(localPath);
  form.append("file", new Blob([buffer], { type: "text/csv" }), path.basename(localPath));

  const response = await fetch(`${resolveAiEngineUrl()}/files/upload`, {
    method: "POST",
    body: form,
    headers: {
      Accept: "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload?.message || `AI upload failed with status ${response.status}`);
    err.response = {
      status: response.status,
      data: payload,
    };
    throw err;
  }

  return payload?.data?.file_path;
};

const analyseDataset = async (filePath, columns) =>
  call("post", "/analyse", { file_path: await uploadFileToAiEngine(filePath), columns });

const runAutoML = async (filePath, targetColumn, config = {}) =>
  call("post", "/automl", {
    file_path: await uploadFileToAiEngine(filePath),
    target_column: targetColumn,
    config,
  });

const runPredictions = async (filePath, modelId) =>
  call("post", "/predict", { file_path: await uploadFileToAiEngine(filePath), model_id: modelId });

const detectDrift = async (currentFilePath, referenceFilePath) =>
  call("post", "/drift", {
    current_file_path: await uploadFileToAiEngine(currentFilePath),
    reference_file_path: await uploadFileToAiEngine(referenceFilePath),
  });

const auditBias = async (filePath, targetColumn, sensitiveAttrs) =>
  call("post", "/bias", {
    file_path: await uploadFileToAiEngine(filePath),
    target_column: targetColumn,
    sensitive_attributes: sensitiveAttrs,
  });

const detectAnomalies = async (filePath, columns) =>
  call("post", "/anomaly", { file_path: await uploadFileToAiEngine(filePath), columns });

const getQualityReport = async (filePath) =>
  call("get", "/quality", { params: { file_path: await uploadFileToAiEngine(filePath) } });

const explainPrediction = async (filePath, modelId, rowIndex = 0, topN = 5) =>
  call("post", "/explanations", {
    file_path: await uploadFileToAiEngine(filePath),
    model_id: modelId,
    row_index: rowIndex,
    top_n: topN,
  });

const retrainModel = async (filePath, targetColumn, currentModelId, driftScore, config = {}) =>
  call("post", "/retrain", {
    file_path: await uploadFileToAiEngine(filePath),
    target_column: targetColumn,
    current_model_id: currentModelId,
    drift_score: driftScore,
    config,
  });

const simulateRealtime = async ({
  filePath,
  modelId,
  cursor = 0,
  batchSize = 20,
  referenceFilePath,
  targetColumn,
  sensitiveAttributes = [],
}) =>
  call("post", "/simulate", {
    file_path: await uploadFileToAiEngine(filePath),
    model_id: modelId,
    cursor,
    batch_size: batchSize,
    reference_file_path: referenceFilePath ? await uploadFileToAiEngine(referenceFilePath) : referenceFilePath,
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
      err.message = `AI engine is unreachable at ${resolveAiEngineUrl()}/governance/report`;
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
