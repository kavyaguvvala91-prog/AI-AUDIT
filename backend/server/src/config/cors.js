/**
 * src/config/cors.js
 * ──────────────────
 * Builds the cors() options object from environment variables.
 * Allows multiple origins specified as a comma-separated list in CORS_ORIGINS.
 */

const logger = require("../utils/logger");

// Parse comma-separated origins from env
const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  "http://localhost:3000,http://127.0.0.1:3000,http://192.168.1.3:3000,http://localhost:3001,http://127.0.0.1:3001,http://192.168.1.3:3001"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const DEV_ALLOWED_PORTS = new Set(["3000", "3001", "4173", "5173"]);

const isPrivateDevOrigin = (origin) => {
  if (process.env.NODE_ENV === "production") return false;

  try {
    const { protocol, hostname, port } = new URL(origin);
    if (!["http:", "https:"].includes(protocol)) return false;
    if (!DEV_ALLOWED_PORTS.has(port || (protocol === "https:" ? "443" : "80"))) return false;

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || isPrivateDevOrigin(origin)) {
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
