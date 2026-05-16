/**
 * src/config/cors.js
 * ──────────────────
 * Builds the cors() options object from environment variables.
 * Allows multiple origins specified as a comma-separated list in CORS_ORIGINS.
 */

const logger = require("../utils/logger");

// Parse comma-separated origins from env
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn(`CORS blocked request from origin: ${origin}`);
    return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  exposedHeaders: ["X-Total-Count"], // Useful for paginated list responses
  credentials: true,
  optionsSuccessStatus: 200, // Safari compatibility
};

module.exports = { corsOptions, allowedOrigins };
