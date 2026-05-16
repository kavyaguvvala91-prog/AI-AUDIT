/**
 * src/config/multer.js
 * ─────────────────────
 * Configures Multer for CSV uploads:
 *  • Stores files in the local /uploads directory
 *  • Enforces file-type whitelist (CSV / plain-text)
 *  • Limits file size to MAX_FILE_SIZE_MB (default 50 MB)
 *  • Generates collision-proof filenames using uuid + original extension
 */

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// ── Upload directory ──────────────────────────────────────────────────────────
const UPLOAD_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  process.env.UPLOAD_DIR || "uploads"
);

// Create the directory if it doesn't exist (first boot, fresh clone, etc.)
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Storage engine ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),

  filename: (_req, file, cb) => {
    // <uuid>-<original-name> keeps filenames unique while remaining human-readable
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${uuidv4()}-${safeName}`);
  },
});

// ── MIME-type / extension whitelist ──────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set(["text/csv", "text/plain", "application/csv", "application/vnd.ms-excel"]);
const ALLOWED_EXTENSIONS = new Set([".csv", ".txt"]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(ext)) {
    return cb(null, true); // Accept
  }

  cb(
    new multer.MulterError(
      "LIMIT_UNEXPECTED_FILE",
      `Only CSV files are allowed. Received: ${file.mimetype}`
    )
  );
};

// ── Size limit ────────────────────────────────────────────────────────────────
const MAX_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 50;
const limits = { fileSize: MAX_SIZE_MB * 1024 * 1024 };

// ── Export configured Multer instance ─────────────────────────────────────────
const upload = multer({ storage, fileFilter, limits });

module.exports = { upload, UPLOAD_DIR };
