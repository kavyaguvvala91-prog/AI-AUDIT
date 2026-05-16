/**
 * src/middleware/validate.js
 * ───────────────────────────
 * Reusable validation middleware functions.
 * Each function is an Express middleware that calls next() if valid or
 * immediately sends a 400 response if invalid.
 */

const mongoose = require("mongoose");
const { sendBadRequest } = require("../utils/apiResponse");

/**
 * Validates that req.params.id is a valid MongoDB ObjectId.
 * Prevents Mongoose CastErrors from polluting the global error handler.
 */
const validateObjectId = (paramName = "id") => (req, res, next) => {
  const id = req.params[paramName];
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendBadRequest(res, `'${id}' is not a valid ID`, "INVALID_ID");
  }
  next();
};

/**
 * Validates that the request body contains all required fields.
 * @param {string[]} fields — list of required field names
 */
const requireBodyFields = (fields) => (req, res, next) => {
  const missing = fields.filter(
    (field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === ""
  );

  if (missing.length > 0) {
    return sendBadRequest(
      res,
      `Missing required fields: ${missing.join(", ")}`,
      "MISSING_FIELDS"
    );
  }

  next();
};

/**
 * Ensures a file was actually attached to the multipart request.
 * Use after multer middleware.
 */
const requireFile = (req, res, next) => {
  if (!req.file) {
    return sendBadRequest(res, "No file uploaded. Please attach a CSV file.", "NO_FILE");
  }
  next();
};

/**
 * Validates pagination query parameters (page, limit).
 * Normalises them to integers and sets safe defaults.
 */
const paginationQuery = (req, _res, next) => {
  req.pagination = {
    page: Math.max(1, parseInt(req.query.page, 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20)),
  };
  next();
};

module.exports = { validateObjectId, requireBodyFields, requireFile, paginationQuery };
