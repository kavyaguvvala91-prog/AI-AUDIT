/**
 * Configures and exports the Express application.
 */

require("express-async-errors");

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const { corsOptions } = require("./config/cors");
const { globalErrorHandler, notFoundHandler } = require("./middleware/errorHandler");
const logger = require("./utils/logger");

const datasetRoutes = require("./routes/dataset.routes");
const demoRoutes = require("./routes/demo.routes");
const analysisRoutes = require("./routes/analysis.routes");
const monitoringRoutes = require("./routes/monitoring.routes");
const healthRoutes = require("./routes/health.routes");
const mlopsRoutes = require("./routes/mlops.routes");
const remediationRoutes = require("./routes/remediation.routes");
const governanceRoutes = require("./routes/governance.routes");
const modelRoutes = require("./routes/model.routes");
const insightsRoutes = require("./routes/insights.routes");

const app = express();
const frontendDistDir = process.env.FRONTEND_DIST_DIR
  ? path.resolve(process.env.FRONTEND_DIST_DIR)
  : path.resolve(__dirname, "..", "..", "..", "frontend", "dist");
const hasFrontendBuild = fs.existsSync(path.join(frontendDistDir, "index.html"));

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  logger.info(`-> ${req.method} ${req.originalUrl}`);
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

if (hasFrontendBuild) {
  app.use(express.static(frontendDistDir));
}

const API = "/api/v1";

app.use(`${API}/health`, healthRoutes);
app.use(`${API}/datasets`, datasetRoutes);
app.use(`${API}/demo`, demoRoutes);
app.use(`${API}/analysis`, analysisRoutes);
app.use(`${API}/monitoring`, monitoringRoutes);
app.use(`${API}/mlops`, mlopsRoutes);
app.use(`${API}/remediation`, remediationRoutes);
app.use(`${API}/governance`, governanceRoutes);
app.use(`${API}/model`, modelRoutes);
app.use(`${API}/insights`, insightsRoutes);

if (hasFrontendBuild) {
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDistDir, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
