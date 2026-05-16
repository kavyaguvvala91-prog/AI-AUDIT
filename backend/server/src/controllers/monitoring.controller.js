/**
 * src/controllers/monitoring.controller.js
 * ──────────────────────────────────────────
 * Handles the three monitoring endpoints:
 *   • Drift detection (data/concept drift vs a reference dataset)
 *   • Bias monitoring (fairness audit across sensitive attributes)
 *   • Anomaly detection (outlier identification)
 *
 * Also provides GET endpoints to retrieve previously stored results
 * without re-running the AI engine (useful for dashboards).
 */

const datasetService = require("../services/dataset.service");
const aiEngineService = require("../services/aiEngine.service");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const logger = require("../utils/logger");

// ── Helper: generic AI monitoring job runner ──────────────────────────────────
/**
 * Generic handler that runs an AI monitoring job and persists the result.
 * @param {string}   resultKey  — dataset sub-doc key (drift | bias | anomaly)
 * @param {Function} engineFn   — aiEngineService function to call
 * @param {any[]}    engineArgs — arguments forwarded to engineFn
 */
const runMonitoringJob = async (res, { datasetId, resultKey, engineFn, engineArgs }) => {
  const dataset = await datasetService.getDatasetById(datasetId);

  await datasetService.markAIJobRunning(dataset._id, resultKey);

  logger.info(`[${resultKey.toUpperCase()}] Starting for dataset ${dataset._id}`);

  let aiResult;
  try {
    aiResult = await engineFn(...engineArgs);
  } catch (err) {
    await datasetService.saveAIResult(dataset._id, resultKey, { error: err.message }, "failed");
    throw err;
  }

  const updated = await datasetService.saveAIResult(dataset._id, resultKey, aiResult);

  return sendSuccess(res, {
    message: `${resultKey} job completed`,
    data: { datasetId: updated._id, [resultKey]: updated[resultKey] },
  });
};

// ── POST /api/v1/monitoring/:id/drift ─────────────────────────────────────────
/**
 * Detect drift between this dataset and a reference dataset.
 * Body: { referenceDatasetId: string }
 */
const runDriftDetection = async (req, res) => {
  const { referenceDatasetId } = req.body;

  if (!referenceDatasetId) {
    return sendError(res, {
      statusCode: 400,
      message: "referenceDatasetId is required for drift detection.",
      error: "MISSING_REFERENCE",
    });
  }

  // Load both datasets to get their file paths
  const [currentDataset, referenceDataset] = await Promise.all([
    datasetService.getDatasetById(req.params.id),
    datasetService.getDatasetById(referenceDatasetId),
  ]);

  await datasetService.markAIJobRunning(currentDataset._id, "drift");

  logger.info(`[DRIFT] Current: ${currentDataset._id} | Reference: ${referenceDataset._id}`);

  let aiResult;
  try {
    aiResult = await aiEngineService.detectDrift(
      currentDataset.filePath,
      referenceDataset.filePath
    );
  } catch (err) {
    await datasetService.saveAIResult(currentDataset._id, "drift", { error: err.message }, "failed");
    throw err;
  }

  const updated = await datasetService.saveAIResult(currentDataset._id, "drift", aiResult);

  return sendSuccess(res, {
    message: "Drift detection completed",
    data: { datasetId: updated._id, drift: updated.drift },
  });
};

// ── POST /api/v1/monitoring/:id/bias ──────────────────────────────────────────
/**
 * Audit the dataset for bias across sensitive attributes.
 * Body: { targetColumn?: string, sensitiveAttributes: string[] }
 */
const runBiasMonitoring = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);

  const targetColumn = req.body.targetColumn || dataset.targetColumn;
  const sensitiveAttributes = req.body.sensitiveAttributes;

  if (!targetColumn) {
    return sendError(res, {
      statusCode: 400,
      message: "targetColumn is required for bias monitoring.",
      error: "MISSING_TARGET_COLUMN",
    });
  }

  if (!Array.isArray(sensitiveAttributes) || sensitiveAttributes.length === 0) {
    return sendError(res, {
      statusCode: 400,
      message: "sensitiveAttributes must be a non-empty array of column names.",
      error: "MISSING_SENSITIVE_ATTRIBUTES",
    });
  }

  return runMonitoringJob(res, {
    datasetId: req.params.id,
    resultKey: "bias",
    engineFn: aiEngineService.auditBias,
    engineArgs: [dataset.filePath, targetColumn, sensitiveAttributes],
  });
};

// ── POST /api/v1/monitoring/:id/anomaly ───────────────────────────────────────
/**
 * Detect anomalies / outliers in the dataset.
 * Body: { columns?: string[] } — optional subset of columns to inspect
 */
const runAnomalyDetection = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);

  return runMonitoringJob(res, {
    datasetId: req.params.id,
    resultKey: "anomaly",
    engineFn: aiEngineService.detectAnomalies,
    engineArgs: [dataset.filePath, req.body.columns || dataset.columns],
  });
};

// ── GET /api/v1/monitoring/:id/results ────────────────────────────────────────
/**
 * Return all stored monitoring results for a dataset without re-running jobs.
 * Useful for dashboard polling.
 */
const getMonitoringResults = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);

  const results = {
    drift: dataset.drift,
    bias: dataset.bias,
    anomaly: dataset.anomaly,
    predictions: dataset.predictions,
  };

  return sendSuccess(res, {
    message: "Monitoring results retrieved",
    data: { datasetId: dataset._id, status: dataset.status, results },
  });
};

// ── GET /api/v1/monitoring/:id/predictions ────────────────────────────────────
/**
 * Return stored prediction results (confidence scores, predicted labels).
 */
const getPredictions = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);

  if (!dataset.predictions?.payload) {
    return sendError(res, {
      statusCode: 404,
      message: "No prediction results found. Run predictions first.",
      error: "NO_PREDICTIONS",
    });
  }

  return sendSuccess(res, {
    message: "Predictions retrieved",
    data: {
      datasetId: dataset._id,
      predictions: dataset.predictions.payload,
      confidence: dataset.predictions.payload?.confidence ?? null,
      completedAt: dataset.predictions.completed_at,
    },
  });
};

module.exports = {
  runDriftDetection,
  runBiasMonitoring,
  runAnomalyDetection,
  getMonitoringResults,
  getPredictions,
};
