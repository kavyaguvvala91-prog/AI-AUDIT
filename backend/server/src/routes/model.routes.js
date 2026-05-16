const router = require("express").Router();
const controller = require("../controllers/mlops.controller");
const { validateObjectId } = require("../middleware/validate");

router.param("id", validateObjectId("id"));

router.post("/:id/retrain", controller.runRetraining);
router.post("/:id/rollback", controller.rollbackModel);

module.exports = router;
