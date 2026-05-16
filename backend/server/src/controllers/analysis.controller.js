/**
 * src/controllers/analysis.controller.js
 * ────────────────────────────────────────
 * Handles endpoints that trigger AI engine tasks:
 *   • Dataset analysis (structure, stats)
 *   • AutoML training
 *   • Predictions
 *
 * Each endpoint follows the same pattern:
 *   1. Fetch dataset from DB
 *   2. Mark the relevant sub-job as "running"
 *   3. Call the AI engine (async via Axios)
 *   4. Persist the result back to the dataset document
 *   5. Return the result to the client
 *
 * NOTE: For production, steps 2-4 should run in a background job queue
 * (e.g., BullMQ) and the endpoint should immediately return 202 Accepted.
 * This implementation keeps it synchronous for hackathon simplicity.
 */

const datasetService = require("../services/dataset.service");
const aiEngineService = require("../services/aiEngine.service");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const logger = require("../utils/logger");

// ── POST /api/v1/analysis/:id/run ─────────────────────────────────────────────
/**
 * Run full dataset analysis (column stats, data quality, distributions).
 */
const runAnalysis = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);

  await datasetService.markAIJobRunning(dataset._id, "analysis");

  logger.info(`[Analysis] Starting for dataset ${dataset._id}`);

  let aiResult;
  try {
    aiResult = await aiEngineService.analyseDataset(dataset.filePath, dataset.columns);
  } catch (err) {
    // Save failure state so the UI can show a meaningful error
    await datasetService.saveAIResult(dataset._id, "analysis", { error: err.message }, "failed");
    throw err; // Re-throw — globalErrorHandler will format the response
  }

  const updated = await datasetService.saveAIResult(dataset._id, "analysis", aiResult);

  return sendSuccess(res, {
    message: "Dataset analysis completed",
    data: { datasetId: updated._id, analysis: updated.analysis },
  });
};

// ── POST /api/v1/analysis/:id/automl ─────────────────────────────────────────
/**
 * Trigger AutoML training.
 * Body: { targetColumn?: string, config?: object }
 */
const runAutoML = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);

  const targetColumn = req.body.targetColumn || dataset.targetColumn;

  if (!targetColumn) {
    return sendError(res, {
      statusCode: 400,
      message: "targetColumn is required for AutoML. Provide it in the request body or set it on the dataset.",
      error: "MISSING_TARGET_COLUMN",
    });
  }

  await datasetService.markAIJobRunning(dataset._id, "automl");

  logger.info(`[AutoML] Starting for dataset ${dataset._id}, target: ${targetColumn}`);

  let aiResult;
  try {
    aiResult = await aiEngineService.runAutoML(dataset.filePath, targetColumn, req.body.config || {});
  } catch (err) {
    await datasetService.saveAIResult(dataset._id, "automl", { error: err.message }, "failed");
    throw err;
  }

  const updated = await datasetService.saveAIResult(dataset._id, "automl", aiResult);

  const trainingData = aiResult?.data;
  if (trainingData?.model_id) {
    await datasetService.registerModelVersion(dataset._id, {
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

  return sendSuccess(res, {
    message: "AutoML training completed",
    data: { datasetId: updated._id, automl: updated.automl },
  });
};

// ── POST /api/v1/analysis/:id/predict ────────────────────────────────────────
/**
 * Run predictions on a dataset using a previously trained model.
 * Body: { modelId: string }
 */
const runPredictions = async (req, res) => {
  const { modelId } = req.body;

  if (!modelId) {
    return sendError(res, {
      statusCode: 400,
      message: "modelId is required. Run AutoML first to obtain a model ID.",
      error: "MISSING_MODEL_ID",
    });
  }

  const dataset = await datasetService.getDatasetById(req.params.id);

  await datasetService.markAIJobRunning(dataset._id, "predictions");

  logger.info(`[Predictions] Dataset ${dataset._id}, model ${modelId}`);

  let aiResult;
  try {
    aiResult = await aiEngineService.runPredictions(dataset.filePath, modelId);
  } catch (err) {
    await datasetService.saveAIResult(dataset._id, "predictions", { error: err.message }, "failed");
    throw err;
  }

  const updated = await datasetService.saveAIResult(dataset._id, "predictions", aiResult);

  return sendSuccess(res, {
    message: "Predictions completed",
    data: { datasetId: updated._id, predictions: updated.predictions },
  });
};

module.exports = { runAnalysis, runAutoML, runPredictions };
