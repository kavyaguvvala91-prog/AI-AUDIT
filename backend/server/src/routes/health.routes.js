/**
 * src/routes/health.routes.js
 * ─────────────────────────────
 *   GET /api/v1/health        — liveness probe
 *   GET /api/v1/health/db     — MongoDB status
 *   GET /api/v1/health/ai     — AI engine status
 */

const router = require("express").Router();
const controller = require("../controllers/health.controller");

router.get("/", controller.liveness);
router.get("/db", controller.dbHealth);
router.get("/ai", controller.aiEngineHealth);

module.exports = router;
