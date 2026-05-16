const fs = require("fs");
const path = require("path");

const { UPLOAD_DIR } = require("../config/multer");
const Dataset = require("../models/Dataset.model");
const datasetService = require("./dataset.service");
const aiEngineService = require("./aiEngine.service");
const { validateCSV } = require("../utils/csvHelper");
const logger = require("../utils/logger");

const TARGET_COLUMN = "Loan_Status";
const SENSITIVE_ATTRIBUTES = ["Gender"];
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const SAMPLE_DATASET_DIR = path.join(REPO_ROOT, "sample_datasets");
const RESETTABLE_JOB_KEYS = [
  "analysis",
  "automl",
  "predictions",
  "drift",
  "bias",
  "anomaly",
  "quality",
  "explanations",
  "retraining",
  "simulation",
  "remediation",
  "governance",
  "autoFix",
];

const DEMO_DATASETS = {
  train: {
    key: "train",
    name: "Loan Prediction Demo - Train",
    sourceFilename: "train_u6lujuX_CVtuZ9i.csv",
    storedFilename: "demo-loan-prediction-train.csv",
    description: "Built-in training baseline for the loan approval governance demo.",
    tags: ["demo", "loan-prediction", "baseline"],
  },
  test: {
    key: "test",
    name: "Loan Prediction Demo - Test",
    sourceFilename: "test_Y3wMUE5_7gLdaTN.csv",
    storedFilename: "demo-loan-prediction-test.csv",
    scoredStoredFilename: "demo-loan-prediction-test-scored.csv",
    description: "Built-in evaluation dataset for the loan approval governance demo.",
    tags: ["demo", "loan-prediction", "evaluation"],
  },
};

const isCompletedJob = (job) => job?.status === "completed" && Boolean(job?.payload);

const buildJobResetState = (jobKeys = RESETTABLE_JOB_KEYS) =>
  jobKeys.reduce(
    (state, key) => ({
      ...state,
      [`${key}.status`]: "pending",
      [`${key}.started_at`]: null,
      [`${key}.completed_at`]: null,
      [`${key}.error`]: null,
      [`${key}.payload`]: null,
    }),
    {}
  );

const copySampleDataset = (config) => {
  const sourcePath = path.join(SAMPLE_DATASET_DIR, config.sourceFilename);
  const destinationPath = path.join(UPLOAD_DIR, config.storedFilename);

  if (!fs.existsSync(sourcePath)) {
    const err = new Error(`Demo dataset is missing: ${sourcePath}`);
    err.statusCode = 500;
    throw err;
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);

  return destinationPath;
};

const datasetHasTargetColumn = (dataset) => Array.isArray(dataset?.columns) && dataset.columns.includes(TARGET_COLUMN);

const upsertDemoDataset = async (config) => {
  const filePath = copySampleDataset(config);
  const stats = fs.statSync(filePath);
  const validation = await validateCSV(filePath);

  if (!validation.valid) {
    const err = new Error(`Demo dataset validation failed for ${config.sourceFilename}: ${validation.error}`);
    err.statusCode = 422;
    throw err;
  }

  const payload = {
    name: config.name,
    originalFilename: config.sourceFilename,
    storedFilename: path.basename(filePath),
    filePath,
    fileSizeBytes: stats.size,
    mimeType: "text/csv",
    rowCount: validation.rowCount,
    columnCount: validation.columnCount,
    columns: validation.columns,
    description: config.description,
    tags: config.tags,
    targetColumn: TARGET_COLUMN,
  };

  const existing = await Dataset.findOne({ name: config.name }).sort({ createdAt: -1 });
  if (existing) {
    return Dataset.findByIdAndUpdate(
      existing._id,
      {
        $set: {
          ...payload,
          status: "uploaded",
          currentModel: {},
          modelVersions: [],
          retrainingHistory: [],
          autoFixHistory: [],
          rollbackHistory: [],
          ...buildJobResetState(),
        },
      },
      { new: true }
    );
  }

  const created = await Dataset.create(payload);
  logger.info(`[Demo] Created dataset ${created._id} for ${config.key}`);
  return created;
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

const ensureAnalysisReady = async (dataset) => {
  if (isCompletedJob(dataset.analysis)) return dataset;
  return runStoredJob(dataset, "analysis", () => aiEngineService.analyseDataset(dataset.filePath, dataset.columns));
};

const ensureTrainingReady = async (dataset) => {
  const modelId = dataset.currentModel?.modelId || dataset.automl?.payload?.data?.model_id;
  const metrics = dataset.automl?.payload?.data?.metrics;
  if (isCompletedJob(dataset.automl) && modelId && metrics) return dataset;

  const refreshed = await runStoredJob(dataset, "automl", () =>
    aiEngineService.runAutoML(dataset.filePath, TARGET_COLUMN, {})
  );

  const trainingData = refreshed.automl?.payload?.data;
  if (trainingData?.model_id) {
    await datasetService.updateDatasetFields(refreshed._id, { targetColumn: TARGET_COLUMN });
    await datasetService.registerModelVersion(refreshed._id, {
      modelId: trainingData.model_id,
      version: trainingData.model_version || "v1",
      parentModelId: trainingData.parent_model_id || null,
      modelType: trainingData.metrics?.model_type || "Unknown",
      problemType: trainingData.metrics?.problem_type || "unknown",
      targetColumn: TARGET_COLUMN,
      metrics: trainingData.metrics || {},
      leaderboard: trainingData.metrics?.leaderboard || [],
      createdAt: new Date(),
      source: "demo-training",
    });
  }

  return datasetService.getDatasetById(dataset._id);
};

const syncEvaluationModelContext = async (evaluationDataset, trainingDataset) => {
  const trainingPayload = trainingDataset.automl?.payload;
  const currentModel = trainingDataset.currentModel;

  if (!trainingPayload?.data?.model_id || !currentModel?.modelId) {
    return evaluationDataset;
  }

  await datasetService.updateDatasetFields(evaluationDataset._id, {
    targetColumn: TARGET_COLUMN,
    currentModel,
    modelVersions: trainingDataset.modelVersions || [],
    "automl.status": trainingDataset.automl?.status || "completed",
    "automl.started_at": trainingDataset.automl?.started_at || null,
    "automl.completed_at": trainingDataset.automl?.completed_at || new Date(),
    "automl.payload": trainingPayload,
  });

  return datasetService.getDatasetById(evaluationDataset._id);
};

const ensurePredictionsReady = async (dataset, modelId) => {
  const existingModelId = dataset.predictions?.payload?.data?.model_id;
  if (isCompletedJob(dataset.predictions) && existingModelId === modelId) return dataset;
  return runStoredJob(dataset, "predictions", () => aiEngineService.runPredictions(dataset.filePath, modelId));
};

const materializeScoredEvaluationDataset = async (dataset, config) => {
  if (datasetHasTargetColumn(dataset)) return dataset;

  const predictions = dataset.predictions?.payload?.data?.predictions || [];
  if (!predictions.length) {
    const err = new Error("Demo evaluation dataset could not be scored because predictions are unavailable.");
    err.statusCode = 500;
    throw err;
  }

  const csvText = fs.readFileSync(dataset.filePath, "utf8").trimEnd();
  const lines = csvText ? csvText.split(/\r?\n/) : [];
  if (lines.length <= 1) {
    const err = new Error(`Demo evaluation dataset is empty: ${dataset.filePath}`);
    err.statusCode = 422;
    throw err;
  }

  const dataLines = lines.slice(1);
  if (dataLines.length !== predictions.length) {
    const err = new Error(
      `Prediction count mismatch for demo evaluation dataset: expected ${dataLines.length}, received ${predictions.length}.`
    );
    err.statusCode = 500;
    throw err;
  }

  const scoredPath = path.join(UPLOAD_DIR, config.scoredStoredFilename || config.storedFilename);
  const scoredLines = [
    `${lines[0]},${TARGET_COLUMN}`,
    ...dataLines.map((line, index) => `${line},${predictions[index].prediction}`),
  ];

  fs.writeFileSync(scoredPath, `${scoredLines.join("\n")}\n`, "utf8");

  const stats = fs.statSync(scoredPath);
  const validation = await validateCSV(scoredPath);
  if (!validation.valid) {
    const err = new Error(`Scored demo dataset validation failed for ${config.sourceFilename}: ${validation.error}`);
    err.statusCode = 422;
    throw err;
  }

  await datasetService.updateDatasetFields(dataset._id, {
    originalFilename: `${config.sourceFilename.replace(/\.csv$/i, "")}_scored.csv`,
    storedFilename: path.basename(scoredPath),
    filePath: scoredPath,
    fileSizeBytes: stats.size,
    rowCount: validation.rowCount,
    columnCount: validation.columnCount,
    columns: validation.columns,
    targetColumn: TARGET_COLUMN,
    ...buildJobResetState(["analysis", "drift", "bias", "anomaly", "quality"]),
  });

  return datasetService.getDatasetById(dataset._id);
};

const ensureAnomalyReady = async (dataset) => {
  if (isCompletedJob(dataset.anomaly)) return dataset;
  return runStoredJob(dataset, "anomaly", () => aiEngineService.detectAnomalies(dataset.filePath, dataset.columns));
};

const ensureBiasReady = async (dataset) => {
  if (isCompletedJob(dataset.bias)) return dataset;
  return runStoredJob(dataset, "bias", () =>
    aiEngineService.auditBias(dataset.filePath, TARGET_COLUMN, SENSITIVE_ATTRIBUTES)
  );
};

const ensureDriftReady = async (currentDataset, referenceDataset) => {
  if (isCompletedJob(currentDataset.drift)) return currentDataset;
  return runStoredJob(currentDataset, "drift", () =>
    aiEngineService.detectDrift(currentDataset.filePath, referenceDataset.filePath)
  );
};

const ensureQualityReady = async (dataset) => {
  if (isCompletedJob(dataset.quality)) return dataset;
  return runStoredJob(dataset, "quality", () => aiEngineService.getQualityReport(dataset.filePath));
};

const loadDemoDatasets = async () => {
  const trainingDataset = await upsertDemoDataset(DEMO_DATASETS.train);
  const evaluationDataset = await upsertDemoDataset(DEMO_DATASETS.test);

  return {
    currentDatasetId: String(evaluationDataset._id),
    referenceDatasetId: String(trainingDataset._id),
    trainDatasetId: String(trainingDataset._id),
    testDatasetId: String(evaluationDataset._id),
    targetColumn: TARGET_COLUMN,
    sensitiveAttributes: SENSITIVE_ATTRIBUTES,
    datasetName: evaluationDataset.name,
  };
};

const prepareDemoAnalysis = async () => {
  const loaded = await loadDemoDatasets();

  let trainingDataset = await datasetService.getDatasetById(loaded.trainDatasetId);
  let evaluationDataset = await datasetService.getDatasetById(loaded.testDatasetId);

  trainingDataset = await ensureAnalysisReady(trainingDataset);
  trainingDataset = await ensureTrainingReady(trainingDataset);

  evaluationDataset = await ensureAnalysisReady(evaluationDataset);
  evaluationDataset = await ensureQualityReady(evaluationDataset);
  evaluationDataset = await syncEvaluationModelContext(evaluationDataset, trainingDataset);

  const modelId = evaluationDataset.currentModel?.modelId || trainingDataset.currentModel?.modelId;
  if (!modelId) {
    const err = new Error("Demo dataset preparation did not produce a trained model.");
    err.statusCode = 500;
    throw err;
  }

  evaluationDataset = await ensurePredictionsReady(evaluationDataset, modelId);
  evaluationDataset = await materializeScoredEvaluationDataset(evaluationDataset, DEMO_DATASETS.test);
  evaluationDataset = await ensureAnalysisReady(evaluationDataset);
  evaluationDataset = await ensureQualityReady(evaluationDataset);
  evaluationDataset = await ensureAnomalyReady(evaluationDataset);
  evaluationDataset = await ensureBiasReady(evaluationDataset);
  evaluationDataset = await ensureDriftReady(evaluationDataset, trainingDataset);

  return {
    ...loaded,
    currentModelId: modelId,
    trainStatus: trainingDataset.status,
    testStatus: evaluationDataset.status,
  };
};

module.exports = {
  loadDemoDatasets,
  prepareDemoAnalysis,
  TARGET_COLUMN,
  SENSITIVE_ATTRIBUTES,
};
