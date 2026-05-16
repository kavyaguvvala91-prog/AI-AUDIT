/**
 * src/models/Dataset.model.js
 * ────────────────────────────
 * Mongoose schema / model for a dataset record.
 * Stores file metadata + the results returned by the Python AI engine
 * for each analysis type.  All AI result sub-documents are optional —
 * they are populated progressively as different analysis jobs complete.
 */

const mongoose = require("mongoose");

// ── Sub-schema: column statistics returned by the AI engine ──────────────────
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

// ── Sub-schema: analysis result ───────────────────────────────────────────────
const AnalysisResultSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["pending", "running", "completed", "failed"], default: "pending" },
    started_at: Date,
    completed_at: Date,
    error: String, // error message if status === 'failed'
    // Flexible payload — each AI task returns different keys
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

// ── Main Dataset Schema ────────────────────────────────────────────────────────
const DatasetSchema = new mongoose.Schema(
  {
    // ── File metadata ─────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Dataset name is required"],
      trim: true,
      maxlength: [255, "Dataset name must be ≤ 255 characters"],
    },

    originalFilename: {
      type: String,
      required: true,
    },

    storedFilename: {
      type: String,
      required: true,
    },

    filePath: {
      type: String,
      required: true,
    },

    fileSizeBytes: {
      type: Number,
      required: true,
    },

    mimeType: {
      type: String,
      default: "text/csv",
    },

    // ── CSV structure info (populated after quick parse on upload) ──
    rowCount: { type: Number, default: 0 },
    columnCount: { type: Number, default: 0 },
    columns: { type: [String], default: [] },
    columnStats: { type: [ColumnStatSchema], default: [] },

    // ── Processing state ──────────────────────────────────────────
    status: {
      type: String,
      enum: ["uploaded", "analysing", "ready", "error"],
      default: "uploaded",
    },

    // ── AI Results (one per analysis type) ───────────────────────
    analysis: { type: AnalysisResultSchema, default: () => ({}) },
    automl: { type: AnalysisResultSchema, default: () => ({}) },
    predictions: { type: AnalysisResultSchema, default: () => ({}) },
    drift: { type: AnalysisResultSchema, default: () => ({}) },
    bias: { type: AnalysisResultSchema, default: () => ({}) },
    anomaly: { type: AnalysisResultSchema, default: () => ({}) },

    // ── Optional user-supplied metadata ──────────────────────────
    description: { type: String, trim: true, maxlength: 1000 },
    tags: { type: [String], default: [] },
    targetColumn: { type: String, trim: true }, // ML target variable

    // ── Soft delete ───────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false, select: false },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────────
DatasetSchema.index({ status: 1, createdAt: -1 });
DatasetSchema.index({ tags: 1 });
DatasetSchema.index({ isDeleted: 1 });

// ── Virtual: human-readable file size ─────────────────────────────────────────
DatasetSchema.virtual("fileSizeFormatted").get(function () {
  const bytes = this.fileSizeBytes;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
});

// ── Pre-find middleware: exclude soft-deleted documents by default ─────────────
DatasetSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

module.exports = mongoose.model("Dataset", DatasetSchema);
