const router = require("express").Router();
const controller = require("../controllers/demo.controller");

router.get("/load", controller.loadDemo);
router.get("/analyze", controller.analyzeDemo);
router.get("/governance", controller.governanceDemo);

module.exports = router;
