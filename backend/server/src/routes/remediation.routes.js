const router = require("express").Router();
const controller = require("../controllers/mlops.controller");
const { validateObjectId } = require("../middleware/validate");

router.param("id", validateObjectId("id"));

router.post("/:id/recommend", controller.getRemediationRecommendations);
router.post("/:id/autofix", controller.runAutoFix);

module.exports = router;
