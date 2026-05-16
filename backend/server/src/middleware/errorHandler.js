/**
 * src/middleware/errorHandler.js
 * ───────────────────────────────
 * Express error-handling middleware.
 *
 *  notFoundHandler  — catches requests that matched no route (404)
 *  globalErrorHandler — last-resort error handler; Express calls this
 *                       when any middleware calls next(err) or an async
 *                       route throws (thanks to express-async-errors).
 */

const multer = require("multer");
const logger = require("../utils/logger");
const { sendError } = require("../utils/apiResponse");

// ── 404 handler ───────────────────────────────────────────────────────────────
const notFoundHandler = (req, res, _next) => {
  return sendError(res, {
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    error: "NOT_FOUND",
  });
};

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
const globalErrorHandler = (err, req, res, _next) => {
  logger.error(`[${req.method} ${req.originalUrl}] ${err.message}`, err.stack);

  // ── Multer errors (file upload problems) ─────────────────────────────────
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 50} MB.`,
      LIMIT_UNEXPECTED_FILE: err.message || "Unexpected file field or invalid file type.",
    };
    return sendError(res, {
      statusCode: 400,
      message: messages[err.code] || `Upload error: ${err.message}`,
      error: "MULTER_ERROR",
      err,
    });
  }

  // ── Mongoose validation errors ────────────────────────────────────────────
  if (err.name === "ValidationError") {
    const fields = Object.values(err.errors)
      .map((e) => `${e.path}: ${e.message}`)
      .join("; ");
    return sendError(res, {
      statusCode: 422,
      message: `Validation failed: ${fields}`,
      error: "VALIDATION_ERROR",
      err,
    });
  }

  // ── Mongoose CastError (invalid ObjectId in URL param) ────────────────────
  if (err.name === "CastError") {
    return sendError(res, {
      statusCode: 400,
      message: `Invalid ID format: ${err.value}`,
      error: "CAST_ERROR",
      err,
    });
  }

  // ── Mongoose duplicate key ────────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {}).join(", ");
    return sendError(res, {
      statusCode: 409,
      message: `Duplicate value for field: ${field}`,
      error: "DUPLICATE_KEY",
      err,
    });
  }

  // ── Axios / AI engine connectivity errors ─────────────────────────────────
  if (err.isAxiosError) {
    const status = err.response?.status;
    const detail = err.response?.data?.detail ?? err.message;

    if (!err.response) {
      return sendError(res, {
        statusCode: 503,
        message: "AI engine is unreachable. Please ensure the Python service is running.",
        error: "AI_ENGINE_UNAVAILABLE",
        err,
      });
    }

    return sendError(res, {
      statusCode: status ?? 502,
      message: `AI engine returned an error: ${detail}`,
      error: "AI_ENGINE_ERROR",
      err,
    });
  }

  // ── CORS error ────────────────────────────────────────────────────────────
  if (err.message && err.message.startsWith("Origin")) {
    return sendError(res, { statusCode: 403, message: err.message, error: "CORS_BLOCKED", err });
  }

  // ── Fallback: 500 Internal Server Error ───────────────────────────────────
  return sendError(res, {
    statusCode: err.statusCode || 500,
    message: err.message || "Internal server error",
    error: "INTERNAL_ERROR",
    err,
  });
};

module.exports = { notFoundHandler, globalErrorHandler };
