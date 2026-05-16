/**
 * src/app.js
 * ──────────
 * Configures and exports the Express application.
 * Separating app setup from server startup lets Jest / Supertest import the app
 * without binding a port, keeping unit & integration tests clean.
 */

require("express-async-errors"); // Patches Express so async route errors propagate to error middleware

const express = require("express");
const cors = require("cors");
const path = require("path");

const { corsOptions } = require("./config/cors");
const { globalErrorHandler, notFoundHandler } = require("./middleware/errorHandler");
const logger = require("./utils/logger");

// ── Route Imports ─────────────────────────────────────────────────────────────
const datasetRoutes = require("./routes/dataset.routes");
const analysisRoutes = require("./routes/analysis.routes");
const monitoringRoutes = require("./routes/monitoring.routes");
const healthRoutes = require("./routes/health.routes");

const app = express();

// ── Global Middleware ─────────────────────────────────────────────────────────

// CORS — configured from environment
app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logger (dev-friendly one-liner per request)
app.use((req, _res, next) => {
  logger.info(`→ ${req.method} ${req.originalUrl}`);
  next();
});

// Serve uploaded files statically so the frontend can preview CSVs if needed
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ── API Routes ────────────────────────────────────────────────────────────────
const API = "/api/v1";

app.use(`${API}/health`, healthRoutes);           // GET  /api/v1/health
app.use(`${API}/datasets`, datasetRoutes);        // CRUD /api/v1/datasets
app.use(`${API}/analysis`, analysisRoutes);       // POST /api/v1/analysis/:id/run  etc.
app.use(`${API}/monitoring`, monitoringRoutes);   // GET  /api/v1/monitoring/:id/*

// ── 404 & Global Error Handlers ───────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
