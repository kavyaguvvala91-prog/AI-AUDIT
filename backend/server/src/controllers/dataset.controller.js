/**
 * src/controllers/dataset.controller.js
 * ───────────────────────────────────────
 * Handles all dataset CRUD endpoints.
 * Thin controllers — all business logic lives in dataset.service.js.
 */

const datasetService = require("../services/dataset.service");
const { sendSuccess, sendError } = require("../utils/apiResponse");

// ── POST /api/v1/datasets/upload ──────────────────────────────────────────────
/**
 * Upload a new CSV dataset.
 * Multer populates req.file; validate.requireFile ensures it's present.
 */
const uploadDataset = async (req, res) => {
  const dataset = await datasetService.createDataset(req.file, req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Dataset uploaded successfully",
    data: dataset,
  });
};

// ── GET /api/v1/datasets ──────────────────────────────────────────────────────
/**
 * List datasets with optional filtering and pagination.
 * Query params: page, limit, status, search
 */
const listDatasets = async (req, res) => {
  const { page, limit } = req.pagination;
  const { status, search } = req.query;

  const result = await datasetService.listDatasets({ page, limit, status, search });

  res.setHeader("X-Total-Count", result.total);

  return sendSuccess(res, {
    message: "Datasets retrieved",
    data: result.datasets,
    meta: {
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
    },
  });
};

// ── GET /api/v1/datasets/:id ──────────────────────────────────────────────────
const getDataset = async (req, res) => {
  const dataset = await datasetService.getDatasetById(req.params.id);
  return sendSuccess(res, { message: "Dataset retrieved", data: dataset });
};

// ── PATCH /api/v1/datasets/:id ────────────────────────────────────────────────
const updateDataset = async (req, res) => {
  const dataset = await datasetService.updateDataset(req.params.id, req.body);
  return sendSuccess(res, { message: "Dataset updated", data: dataset });
};

// ── DELETE /api/v1/datasets/:id ───────────────────────────────────────────────
const deleteDataset = async (req, res) => {
  const result = await datasetService.deleteDataset(req.params.id);
  return sendSuccess(res, { message: "Dataset deleted", data: result });
};

module.exports = { uploadDataset, listDatasets, getDataset, updateDataset, deleteDataset };
