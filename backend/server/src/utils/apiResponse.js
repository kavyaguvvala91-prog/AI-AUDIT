/**
 * src/utils/apiResponse.js
 * ─────────────────────────
 * Helper functions that enforce a consistent JSON envelope for every API
 * response.  All routes call these instead of res.json() directly, so the
 * frontend always gets the same shape regardless of the endpoint.
 *
 * Success envelope:
 *   { success: true, message, data, meta }
 *
 * Error envelope:
 *   { success: false, message, error, stack? }
 */

const isDev = process.env.NODE_ENV !== "production";

/**
 * Send a successful response.
 * @param {import('express').Response} res
 * @param {object} options
 * @param {number}  [options.statusCode=200]
 * @param {string}  [options.message="Success"]
 * @param {*}       [options.data=null]
 * @param {object}  [options.meta={}]  — pagination, counts, etc.
 */
const sendSuccess = (res, { statusCode = 200, message = "Success", data = null, meta = {} } = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
  });
};

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {object} options
 * @param {number}  [options.statusCode=500]
 * @param {string}  [options.message="Internal server error"]
 * @param {string}  [options.error=""]
 * @param {Error}   [options.err]  — raw error (stack only shown in dev)
 */
const sendError = (res, { statusCode = 500, message = "Internal server error", error = "", err } = {}) => {
  const body = {
    success: false,
    message,
    error,
  };

  // Expose stack trace in development for faster debugging
  if (isDev && err?.stack) body.stack = err.stack;

  return res.status(statusCode).json(body);
};

/**
 * Shorthand for 404 Not Found.
 */
const sendNotFound = (res, resource = "Resource") =>
  sendError(res, { statusCode: 404, message: `${resource} not found`, error: "NOT_FOUND" });

/**
 * Shorthand for 400 Bad Request / validation errors.
 */
const sendBadRequest = (res, message = "Bad request", error = "BAD_REQUEST") =>
  sendError(res, { statusCode: 400, message, error });

module.exports = { sendSuccess, sendError, sendNotFound, sendBadRequest };
