const datasetService = require("./dataset.service");
const aiEngineService = require("./aiEngine.service");
const logger = require("../utils/logger");

let timer = null;

const extractData = (payload) => payload?.data || {};

const runCycle = async () => {
  const datasets = await datasetService.getRetrainableDatasets();
  for (const dataset of datasets) {
    try {
      const drift = extractData(dataset.drift?.payload);
      const automl = extractData(dataset.automl?.payload);
      const driftScore = drift?.drift_score;
      const threshold = drift?.threshold ?? Number(process.env.DRIFT_THRESHOLD || 0.2);
      const currentModelId = dataset.currentModel?.modelId || automl?.model_id;
      const targetColumn = dataset.targetColumn || automl?.target_column;

      if (!currentModelId || !targetColumn || typeof driftScore !== "number" || driftScore < threshold) {
        continue;
      }

      logger.info(`[Scheduler] Auto retraining dataset ${dataset._id} with drift score ${driftScore}`);
      const retraining = await aiEngineService.retrainModel(
        dataset.filePath,
        targetColumn,
        currentModelId,
        driftScore,
        {}
      );
      const retrainData = extractData(retraining);
      await datasetService.saveAIResult(dataset._id, "retraining", retraining);

      if (retrainData.triggered && retrainData.training_result?.model_id) {
        await datasetService.registerModelVersion(dataset._id, {
          modelId: retrainData.training_result.model_id,
          version: retrainData.training_result.model_version || retrainData.new_version || "v1",
          parentModelId: retrainData.previous_model_id || null,
          modelType: retrainData.training_result.metrics?.model_type || "Unknown",
          problemType: retrainData.training_result.metrics?.problem_type || "unknown",
          targetColumn: retrainData.training_result.target_column || targetColumn,
          metrics: retrainData.training_result.metrics || {},
          leaderboard: retrainData.training_result.metrics?.leaderboard || [],
          createdAt: new Date(),
          source: "scheduler",
        });

        await datasetService.updateDatasetFields(dataset._id, {
          "automl.status": "completed",
          "automl.completed_at": new Date(),
          "automl.payload": {
            success: true,
            message: "Active model replaced by scheduler retraining run",
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
    } catch (err) {
      logger.warn(`[Scheduler] Retraining failed for dataset ${dataset._id}: ${err.message}`);
    }
  }
};

const startRetrainingScheduler = () => {
  if (String(process.env.AUTO_RETRAIN_ENABLED || "true").toLowerCase() === "false") {
    logger.info("[Scheduler] Auto retraining is disabled");
    return;
  }
  if (timer) return;

  const intervalMs = Number(process.env.RETRAIN_INTERVAL_MS || 60000);
  timer = setInterval(() => {
    runCycle().catch((err) => logger.warn(`[Scheduler] Cycle failed: ${err.message}`));
  }, intervalMs);
  timer.unref?.();
  logger.info(`[Scheduler] Auto retraining active every ${intervalMs}ms`);
};

module.exports = {
  startRetrainingScheduler,
};
