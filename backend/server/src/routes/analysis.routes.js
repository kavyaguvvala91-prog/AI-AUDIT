/**
 * src/routes/analysis.routes.js
 * ───────────────────────────────
 * Routes that trigger AI engine analysis jobs on a specific dataset.
 *
 *   POST /api/v1/analysis/:id/run      — full dataset analysis
 *   POST /api/v1/analysis/:id/automl   — AutoML training
 *   POST /api/v1/analysis/:id/predict  — run predictions
 */

const router = require("express").Router();
const controller = require("../controllers/analysis.controller");
const { validateObjectId } = require("../middleware/validate");

// All routes share the :id param → validate it once with a param middleware
router.param("id", validateObjectId("id"));

router.post("/:id/run", controller.runAnalysis);
router.post("/:id/automl", controller.runAutoML);
router.post("/:id/predict", controller.runPredictions);

module.exports = router;
