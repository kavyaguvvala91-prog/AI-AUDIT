/**
 * src/services/aiEngine.service.js
 * ──────────────────────────────────
 * Centralises every HTTP call made to the Python FastAPI AI engine.
 * Controllers call these service functions — they never touch aiClient directly.
 *
 * Each function:
 *  1. Accepts only what it needs (file path, column names, config)
 *  2. Returns the engine's response data (not the Axios response object)
 *  3. Throws on error so the global error handler catches it
 *
 * Python endpoint conventions assumed (adjust to match your FastAPI routes):
 *   POST /analyse        → dataset analysis & column stats
 *   POST /automl         → AutoML model training
 *   POST /predict        → run predictions on a trained model
 *   POST /drift          → data/concept drift detection
 *   POST /bias           → fairness / bias audit
 *   POST /anomaly        → anomaly / outlier detection
 */

const aiClient = require("../config/axios");

// ── Helper ────────────────────────────────────────────────────────────────────
/**
 * Extracts the response body from an Axios call.
 * Re-throws with a friendlier message if the engine is down.
 */
const call = async (method, url, payload) => {
  try {
    const response = await aiClient[method](url, payload);
    return response.data;
  } catch (err) {
    // Decorate with a hint then re-throw for globalErrorHandler
    if (!err.response) {
      err.message = `AI engine is unreachable at ${process.env.AI_ENGINE_BASE_URL}${url}`;
    }
    throw err;
  }
};

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Run full dataset analysis.
 * @param {string} filePath  — absolute server path to the CSV
 * @param {string[]} columns — column header names
 * @returns {Promise<object>} AI engine analysis payload
 */
const analyseDataset = (filePath, columns) =>
  call("post", "/analyse", { file_path: filePath, columns });

/**
 * Trigger AutoML model training.
 * @param {string} filePath     — path to the training CSV
 * @param {string} targetColumn — name of the label column
 * @param {object} [config={}]  — optional AutoML hyperparameter overrides
 */
const runAutoML = (filePath, targetColumn, config = {}) =>
  call("post", "/automl", { file_path: filePath, target_column: targetColumn, config });

/**
 * Run predictions using a previously trained model.
 * @param {string} filePath  — path to the inference CSV (features only)
 * @param {string} modelId   — ID of the trained model returned by runAutoML
 */
const runPredictions = (filePath, modelId) =>
  call("post", "/predict", { file_path: filePath, model_id: modelId });

/**
 * Detect data / concept drift compared to a reference dataset.
 * @param {string} currentFilePath   — path to current (production) data
 * @param {string} referenceFilePath — path to baseline / training data
 */
const detectDrift = (currentFilePath, referenceFilePath) =>
  call("post", "/drift", {
    current_file_path: currentFilePath,
    reference_file_path: referenceFilePath,
  });

/**
 * Perform bias / fairness audit.
 * @param {string} filePath         — path to the dataset
 * @param {string} targetColumn     — outcome / label column
 * @param {string[]} sensitiveAttrs — column names to audit for bias (e.g. ["gender","race"])
 */
const auditBias = (filePath, targetColumn, sensitiveAttrs) =>
  call("post", "/bias", {
    file_path: filePath,
    target_column: targetColumn,
    sensitive_attributes: sensitiveAttrs,
  });

/**
 * Detect anomalies / outliers in the dataset.
 * @param {string} filePath      — path to the CSV
 * @param {string[]} [columns]   — optional subset of numeric columns to inspect
 */
const detectAnomalies = (filePath, columns) =>
  call("post", "/anomaly", { file_path: filePath, columns });

module.exports = {
  analyseDataset,
  runAutoML,
  runPredictions,
  detectDrift,
  auditBias,
  detectAnomalies,
};
