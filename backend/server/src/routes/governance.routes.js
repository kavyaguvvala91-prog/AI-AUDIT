const router = require("express").Router();
const controller = require("../controllers/mlops.controller");
const { validateObjectId } = require("../middleware/validate");

router.param("id", validateObjectId("id"));

router.post("/:id/dashboard", controller.getGovernanceDashboard);
router.post("/:id/report", controller.downloadGovernanceReport);

module.exports = router;
