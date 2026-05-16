/**
 * src/routes/monitoring.routes.js
 * ─────────────────────────────────
 * Routes for monitoring jobs and result retrieval:
 *
 *   POST /api/v1/monitoring/:id/drift      — run drift detection
 *   POST /api/v1/monitoring/:id/bias       — run bias audit
 *   POST /api/v1/monitoring/:id/anomaly    — run anomaly detection
 *   GET  /api/v1/monitoring/:id/results    — get all stored monitoring results
 *   GET  /api/v1/monitoring/:id/predictions — get stored predictions
 */

const router = require("express").Router();
const controller = require("../controllers/monitoring.controller");
const { validateObjectId } = require("../middleware/validate");

router.param("id", validateObjectId("id"));

// Trigger jobs
router.post("/:id/drift", controller.runDriftDetection);
router.post("/:id/bias", controller.runBiasMonitoring);
router.post("/:id/anomaly", controller.runAnomalyDetection);

// Retrieve stored results (no AI engine call)
router.get("/:id/results", controller.getMonitoringResults);
router.get("/:id/predictions", controller.getPredictions);

module.exports = router;
