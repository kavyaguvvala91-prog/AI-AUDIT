/**
 * src/services/dataset.service.js
 * ─────────────────────────────────
 * Business logic layer for dataset CRUD operations.
 * Controllers stay thin by delegating DB interactions here.
 */

const fs = require("fs");
const path = require("path");
const Dataset = require("../models/Dataset.model");
const { validateCSV } = require("../utils/csvHelper");
const logger = require("../utils/logger");

/**
 * Creates a new Dataset document from an uploaded Multer file object.
 * Validates the CSV and populates column metadata before saving.
 *
 * @param {object} file      — req.file from Multer
 * @param {object} body      — req.body (name, description, tags, targetColumn)
 * @returns {Promise<Dataset>}
 */
const createDataset = async (file, body) => {
  // 1. Validate CSV structure
  const { valid, error, columns, rowCount, columnCount } = await validateCSV(file.path);

  if (!valid) {
    // Remove the invalid file from disk before throwing
    fs.unlinkSync(file.path);
    const err = new Error(`Invalid CSV: ${error}`);
    err.statusCode = 422;
    throw err;
  }

  // 2. Build and persist the Dataset document
  const dataset = await Dataset.create({
    name: body.name || file.originalname.replace(/\.[^.]+$/, ""),
    originalFilename: file.originalname,
    storedFilename: file.filename,
    filePath: file.path,
    fileSizeBytes: file.size,
    mimeType: file.mimetype,
    rowCount,
    columnCount,
    columns,
    description: body.description,
    tags: body.tags ? body.tags.split(",").map((t) => t.trim()) : [],
    targetColumn: body.targetColumn,
  });

  logger.info(`Dataset created: ${dataset._id} (${rowCount} rows, ${columnCount} cols)`);
  return dataset;
};

/**
 * Returns a paginated list of datasets.
 */
const listDatasets = async ({ page = 1, limit = 20, status, search } = {}) => {
  const filter = {};

  if (status) filter.status = status;

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { tags: { $in: [new RegExp(search, "i")] } },
    ];
  }

  const skip = (page - 1) * limit;

  const [datasets, total] = await Promise.all([
    Dataset.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Dataset.countDocuments(filter),
  ]);

  return {
    datasets,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
  };
};

/**
 * Returns a single dataset by ID.
 */
const getDatasetById = async (id) => {
  const dataset = await Dataset.findById(id);
  if (!dataset) {
    const err = new Error("Dataset not found");
    err.statusCode = 404;
    throw err;
  }
  return dataset;
};

/**
 * Updates a dataset's metadata (not the file itself).
 */
const updateDataset = async (id, updates) => {
  const ALLOWED = ["name", "description", "tags", "targetColumn"];
  const sanitised = Object.fromEntries(
    Object.entries(updates).filter(([k]) => ALLOWED.includes(k))
  );

  if (sanitised.tags && typeof sanitised.tags === "string") {
    sanitised.tags = sanitised.tags.split(",").map((t) => t.trim());
  }

  const dataset = await Dataset.findByIdAndUpdate(id, sanitised, {
    new: true,
    runValidators: true,
  });

  if (!dataset) {
    const err = new Error("Dataset not found");
    err.statusCode = 404;
    throw err;
  }

  return dataset;
};

/**
 * Soft-deletes a dataset and removes the file from disk.
 */
const deleteDataset = async (id) => {
  const dataset = await Dataset.findByIdAndUpdate(
    id,
    { isDeleted: true, status: "error" },
    { new: true }
  );

  if (!dataset) {
    const err = new Error("Dataset not found");
    err.statusCode = 404;
    throw err;
  }

  // Best-effort file removal
  try {
    if (fs.existsSync(dataset.filePath)) {
      fs.unlinkSync(dataset.filePath);
      logger.info(`Deleted file: ${dataset.filePath}`);
    }
  } catch (fileErr) {
    logger.warn(`Could not delete file ${dataset.filePath}: ${fileErr.message}`);
  }

  return { deleted: true, id };
};

/**
 * Updates a specific AI result sub-document on a dataset.
 * @param {string} id         — Dataset ID
 * @param {string} resultKey  — one of: analysis | automl | predictions | drift | bias | anomaly
 * @param {object} payload    — data returned by the AI engine
 * @param {string} status     — "completed" | "failed"
 */
const saveAIResult = async (id, resultKey, payload, status = "completed") => {
  const update = {
    [`${resultKey}.status`]: status,
    [`${resultKey}.completed_at`]: new Date(),
    [`${resultKey}.payload`]: payload,
    status: status === "completed" ? "ready" : "error",
  };

  const dataset = await Dataset.findByIdAndUpdate(id, { $set: update }, { new: true });
  if (!dataset) throw Object.assign(new Error("Dataset not found"), { statusCode: 404 });
  return dataset;
};

/**
 * Marks an AI job as "running" (call at start of async AI job).
 */
const markAIJobRunning = async (id, resultKey) => {
  const update = {
    [`${resultKey}.status`]: "running",
    [`${resultKey}.started_at`]: new Date(),
    status: "analysing",
  };
  await Dataset.findByIdAndUpdate(id, { $set: update });
};

module.exports = {
  createDataset,
  listDatasets,
  getDatasetById,
  updateDataset,
  deleteDataset,
  saveAIResult,
  markAIJobRunning,
};
