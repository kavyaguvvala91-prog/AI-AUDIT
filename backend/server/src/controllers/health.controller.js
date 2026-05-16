/**
 * src/controllers/health.controller.js
 * ──────────────────────────────────────
 * Health-check endpoints.
 *  GET /api/v1/health        — basic liveness check
 *  GET /api/v1/health/db     — MongoDB connectivity
 *  GET /api/v1/health/ai     — AI engine reachability
 */

const mongoose = require("mongoose");
const aiClient = require("../config/axios");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const liveness = (_req, res) => {
  return sendSuccess(res, {
    message: "AI Audit Dashboard API is running",
    data: {
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())}s`,
    },
  });
};

const dbHealth = (_req, res) => {
  const state = mongoose.connection.readyState;
  const states = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

  if (state === 1) {
    return sendSuccess(res, { message: "MongoDB is connected", data: { state: states[state] } });
  }

  return sendError(res, {
    statusCode: 503,
    message: `MongoDB is ${states[state] || "unknown"}`,
    error: "DB_UNAVAILABLE",
  });
};

const aiEngineHealth = async (_req, res) => {
  try {
    const response = await aiClient.get("/health", { timeout: 5000 });
    return sendSuccess(res, {
      message: "AI engine is reachable",
      data: response.data,
    });
  } catch (err) {
    return sendError(res, {
      statusCode: 503,
      message: "AI engine is unreachable",
      error: "AI_ENGINE_UNAVAILABLE",
    });
  }
};

module.exports = { liveness, dbHealth, aiEngineHealth };
