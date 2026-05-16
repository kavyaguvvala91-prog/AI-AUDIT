require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const { startRetrainingScheduler } = require("./src/services/retrainingScheduler.service");
const logger = require("./src/utils/logger");

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    logger.info(`AI Audit Dashboard API running on port ${PORT} [${process.env.NODE_ENV}]`);
    logger.info(`AI Engine target -> ${process.env.AI_ENGINE_BASE_URL}`);
  });

  startRetrainingScheduler();

  const shutdown = (signal) => {
    logger.warn(`${signal} received - shutting down gracefully`);
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection:", reason);
    server.close(() => process.exit(1));
  });
})();
