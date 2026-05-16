const router = require("express").Router();
const controller = require("../controllers/mlops.controller");
const { validateObjectId } = require("../middleware/validate");

router.param("id", validateObjectId("id"));

router.post("/:id/quality", controller.runQualityAnalysis);
router.post("/:id/explanations", controller.runExplainability);
router.post("/:id/retrain", controller.runRetraining);
router.get("/:id/retraining", controller.getRetrainingStatus);
router.get("/:id/comparison", controller.getModelComparison);
router.post("/:id/simulate", controller.simulateRealtime);
router.get("/:id/fairness", controller.getFairnessDashboard);
router.post("/:id/insights", controller.generateInsights);

module.exports = router;
