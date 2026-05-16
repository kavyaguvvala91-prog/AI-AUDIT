/**
 * src/routes/dataset.routes.js
 * ─────────────────────────────
 * Routes:
 *   POST   /api/v1/datasets/upload   — upload a new CSV dataset
 *   GET    /api/v1/datasets           — list datasets (paginated)
 *   GET    /api/v1/datasets/:id       — get one dataset
 *   PATCH  /api/v1/datasets/:id       — update dataset metadata
 *   DELETE /api/v1/datasets/:id       — soft-delete dataset
 */

const router = require("express").Router();
const { upload } = require("../config/multer");
const controller = require("../controllers/dataset.controller");
const { validateObjectId, requireFile, paginationQuery } = require("../middleware/validate");

// Upload — multer runs before requireFile so req.file is set
router.post(
  "/upload",
  upload.single("file"),   // field name expected in multipart form
  requireFile,
  controller.uploadDataset
);

// List
router.get("/", paginationQuery, controller.listDatasets);

// Single
router.get("/:id", validateObjectId("id"), controller.getDataset);

// Update metadata
router.patch("/:id", validateObjectId("id"), controller.updateDataset);

// Delete
router.delete("/:id", validateObjectId("id"), controller.deleteDataset);

module.exports = router;
