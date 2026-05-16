/**
 * server.js
 * ─────────
 * Entry point. Loads env variables, connects to MongoDB, then starts Express.
 * Keeping this file thin makes testing the app module independently easy.
 */

require("dotenv").config(); // Must be first — populates process.env

const app = require("./src/app");
const connectDB = require("./src/config/db");
const logger = require("./src/utils/logger");

const PORT = process.env.PORT || 5000;

(async () => {
  // 1. Connect to MongoDB before accepting any HTTP traffic
  await connectDB();

  // 2. Start HTTP server
  const server = app.listen(PORT, () => {
    logger.info(`🚀  AI Audit Dashboard API running on port ${PORT} [${process.env.NODE_ENV}]`);
    logger.info(`🤖  AI Engine target → ${process.env.AI_ENGINE_BASE_URL}`);
  });

  // 3. Graceful shutdown helpers
  const shutdown = (signal) => {
    logger.warn(`${signal} received — shutting down gracefully`);
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // 4. Catch unhandled promise rejections (e.g., mongoose ops outside request scope)
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection:", reason);
    server.close(() => process.exit(1));
  });
})();
