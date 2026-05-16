const mongoose = require("mongoose");

const ColumnStatSchema = new mongoose.Schema(
  {
    name: String,
    dtype: String,
    missing_pct: Number,
    unique_count: Number,
    mean: Number,
    std: Number,
    min: Number,
    max: Number,
  },
  { _id: false }
);

const AnalysisResultSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["pending", "running", "completed", "failed"], default: "pending" },
    started_at: Date,
    completed_at: Date,
    error: String,
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const ModelVersionSchema = new mongoose.Schema(
  {
    modelId: String,
    version: String,
    parentModelId: String,
    modelType: String,
    problemType: String,
    targetColumn: String,
    metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    leaderboard: { type: [mongoose.Schema.Types.Mixed], default: [] },
    createdAt: { type: Date, default: Date.now },
    source: { type: String, default: "training" },
  },
  { _id: false }
);

const RetrainingLogSchema = new mongoose.Schema(
  {
    triggered: Boolean,
    reason: String,
    driftScore: Number,
    threshold: Number,
    previousModelId: String,
    newModelId: String,
    previousVersion: String,
    newVersion: String,
    comparison: { type: [mongoose.Schema.Types.Mixed], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AutoFixHistorySchema = new mongoose.Schema(
  {
    createdAt: { type: Date, default: Date.now },
    approvalGranted: Boolean,
    executed: Boolean,
    preparedDatasetPath: String,
    rollbackVersion: String,
    rollbackTargetModelId: String,
    retrainingTriggered: Boolean,
    executionLogs: { type: [String], default: [] },
    actions: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

const CurrentModelSchema = new mongoose.Schema(
  {
    modelId: String,
    version: String,
    modelType: String,
    targetColumn: String,
    trainedAt: Date,
  },
  { _id: false }
);

const DatasetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Dataset name is required"],
      trim: true,
      maxlength: [255, "Dataset name must be <= 255 characters"],
    },
    originalFilename: { type: String, required: true },
    storedFilename: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
    mimeType: { type: String, default: "text/csv" },
    rowCount: { type: Number, default: 0 },
    columnCount: { type: Number, default: 0 },
    columns: { type: [String], default: [] },
    columnStats: { type: [ColumnStatSchema], default: [] },
    status: {
      type: String,
      enum: ["uploaded", "analysing", "ready", "error"],
      default: "uploaded",
    },
    analysis: { type: AnalysisResultSchema, default: () => ({}) },
    automl: { type: AnalysisResultSchema, default: () => ({}) },
    predictions: { type: AnalysisResultSchema, default: () => ({}) },
    drift: { type: AnalysisResultSchema, default: () => ({}) },
    bias: { type: AnalysisResultSchema, default: () => ({}) },
    anomaly: { type: AnalysisResultSchema, default: () => ({}) },
    quality: { type: AnalysisResultSchema, default: () => ({}) },
    explanations: { type: AnalysisResultSchema, default: () => ({}) },
    retraining: { type: AnalysisResultSchema, default: () => ({}) },
    simulation: { type: AnalysisResultSchema, default: () => ({}) },
    remediation: { type: AnalysisResultSchema, default: () => ({}) },
    governance: { type: AnalysisResultSchema, default: () => ({}) },
    autoFix: { type: AnalysisResultSchema, default: () => ({}) },
    description: { type: String, trim: true, maxlength: 1000 },
    tags: { type: [String], default: [] },
    targetColumn: { type: String, trim: true },
    autoRetrainEnabled: { type: Boolean, default: true },
    currentModel: { type: CurrentModelSchema, default: () => ({}) },
    modelVersions: { type: [ModelVersionSchema], default: [] },
    retrainingHistory: { type: [RetrainingLogSchema], default: [] },
    autoFixHistory: { type: [AutoFixHistorySchema], default: [] },
    rollbackHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
    isDeleted: { type: Boolean, default: false, select: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

DatasetSchema.index({ status: 1, createdAt: -1 });
DatasetSchema.index({ tags: 1 });
DatasetSchema.index({ isDeleted: 1 });
DatasetSchema.index({ autoRetrainEnabled: 1 });

DatasetSchema.virtual("fileSizeFormatted").get(function () {
  const bytes = this.fileSizeBytes;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
});

DatasetSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

module.exports = mongoose.model("Dataset", DatasetSchema);
