/**
 * src/config/axios.js
 * ────────────────────
 * Pre-configured Axios instance for communicating with the Python FastAPI
 * AI engine.  Having a single shared instance means:
 *  • Base URL and timeouts are set in one place
 *  • Request / response interceptors (logging, retries) apply globally
 *  • Easy to swap to a different AI service URL via .env
 */

const axios = require("axios");
const logger = require("../utils/logger");

const aiClient = axios.create({
  baseURL: process.env.AI_ENGINE_BASE_URL || "http://localhost:8000",
  timeout: 120_000, // 2 minutes — ML inference can be slow
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ── Request interceptor ───────────────────────────────────────────────────────
aiClient.interceptors.request.use(
  (config) => {
    logger.info(`[AI Engine] → ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    logger.error("[AI Engine] Request setup error:", error.message);
    return Promise.reject(error);
  }
);

// ── Response interceptor ──────────────────────────────────────────────────────
aiClient.interceptors.response.use(
  (response) => {
    logger.info(`[AI Engine] ← ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    const status = error.response?.status ?? "N/A";
    const message = error.response?.data?.detail ?? error.message;
    logger.error(`[AI Engine] ← ${status} Error: ${message}`);
    return Promise.reject(error);
  }
);

module.exports = aiClient;
