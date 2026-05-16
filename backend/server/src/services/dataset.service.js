const fs = require("fs");
const Dataset = require("../models/Dataset.model");
const { validateCSV } = require("../utils/csvHelper");
const logger = require("../utils/logger");

const createDataset = async (file, body) => {
  const { valid, error, columns, rowCount, columnCount } = await validateCSV(file.path);

  if (!valid) {
    fs.unlinkSync(file.path);
    const err = new Error(`Invalid CSV: ${error}`);
    err.statusCode = 422;
    throw err;
  }

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
    tags: body.tags ? body.tags.split(",").map((tag) => tag.trim()) : [],
    targetColumn: body.targetColumn,
  });

  logger.info(`Dataset created: ${dataset._id} (${rowCount} rows, ${columnCount} cols)`);
  return dataset;
};

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

const getDatasetById = async (id) => {
  const dataset = await Dataset.findById(id);
  if (!dataset) {
    const err = new Error("Dataset not found");
    err.statusCode = 404;
    throw err;
  }
  return dataset;
};

const updateDataset = async (id, updates) => {
  const allowed = ["name", "description", "tags", "targetColumn", "autoRetrainEnabled"];
  const sanitised = Object.fromEntries(Object.entries(updates).filter(([key]) => allowed.includes(key)));
  if (sanitised.tags && typeof sanitised.tags === "string") {
    sanitised.tags = sanitised.tags.split(",").map((tag) => tag.trim());
  }

  const dataset = await Dataset.findByIdAndUpdate(id, sanitised, { new: true, runValidators: true });
  if (!dataset) {
    const err = new Error("Dataset not found");
    err.statusCode = 404;
    throw err;
  }
  return dataset;
};

const deleteDataset = async (id) => {
  const dataset = await Dataset.findByIdAndUpdate(id, { isDeleted: true, status: "error" }, { new: true });
  if (!dataset) {
    const err = new Error("Dataset not found");
    err.statusCode = 404;
    throw err;
  }

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

const markAIJobRunning = async (id, resultKey) => {
  const update = {
    [`${resultKey}.status`]: "running",
    [`${resultKey}.started_at`]: new Date(),
    status: "analysing",
  };
  await Dataset.findByIdAndUpdate(id, { $set: update });
};

const updateDatasetFields = async (id, fields) =>
  Dataset.findByIdAndUpdate(id, { $set: fields }, { new: true });

const registerModelVersion = async (id, modelVersion) => {
  const update = {
    currentModel: {
      modelId: modelVersion.modelId,
      version: modelVersion.version,
      modelType: modelVersion.modelType,
      targetColumn: modelVersion.targetColumn,
      trainedAt: modelVersion.createdAt || new Date(),
    },
  };

  return Dataset.findByIdAndUpdate(
    id,
    {
      $set: update,
      $push: { modelVersions: modelVersion },
    },
    { new: true }
  );
};

const appendRetrainingHistory = async (id, entry) =>
  Dataset.findByIdAndUpdate(id, { $push: { retrainingHistory: entry } }, { new: true });

const appendAutoFixHistory = async (id, entry) =>
  Dataset.findByIdAndUpdate(id, { $push: { autoFixHistory: entry } }, { new: true });

const appendRollbackHistory = async (id, entry) =>
  Dataset.findByIdAndUpdate(id, { $push: { rollbackHistory: entry } }, { new: true });

const getRetrainableDatasets = async () =>
  Dataset.find({
    autoRetrainEnabled: true,
    "drift.status": "completed",
    "automl.status": "completed",
  });

module.exports = {
  createDataset,
  listDatasets,
  getDatasetById,
  updateDataset,
  deleteDataset,
  saveAIResult,
  markAIJobRunning,
  updateDatasetFields,
  registerModelVersion,
  appendRetrainingHistory,
  appendAutoFixHistory,
  appendRollbackHistory,
  getRetrainableDatasets,
};
