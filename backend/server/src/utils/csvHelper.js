/**
 * src/utils/csvHelper.js
 * ───────────────────────
 * Utility functions for validating and extracting basic metadata from an
 * uploaded CSV file without loading the whole file into memory.
 * The Python AI engine does the heavy lifting; this just gives us enough
 * to populate the Dataset document immediately after upload.
 */

const fs = require("fs");
const readline = require("readline");

/**
 * Reads the first N lines of a file using a readline stream.
 * Returns an array of raw line strings.
 */
const readLines = (filePath, maxLines = 5) =>
  new Promise((resolve, reject) => {
    const lines = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      lines.push(line);
      if (lines.length >= maxLines) rl.close();
    });

    rl.on("close", () => resolve(lines));
    rl.on("error", reject);
  });

/**
 * Counts the total number of lines in a file efficiently.
 * Uses a raw byte stream to avoid string allocation overhead.
 */
const countLines = (filePath) =>
  new Promise((resolve, reject) => {
    let count = 0;
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 0x0a) count++; // newline byte
      }
    });
    stream.on("end", () => resolve(count));
    stream.on("error", reject);
  });

/**
 * Parses the CSV header row and returns column names.
 * Handles both comma and semicolon delimiters.
 */
const parseColumns = (headerLine) => {
  if (!headerLine) return [];

  // Detect delimiter
  const delimiter = headerLine.includes(";") ? ";" : ",";

  return headerLine
    .split(delimiter)
    .map((col) =>
      col
        .trim()
        .replace(/^["']|["']$/g, "") // strip surrounding quotes
        .trim()
    )
    .filter(Boolean);
};

/**
 * Validates that a file looks like a proper CSV.
 * Returns { valid: boolean, error?: string, columns: string[], rowCount: number }
 */
const validateCSV = async (filePath) => {
  try {
    const lines = await readLines(filePath, 3);

    if (lines.length === 0) {
      return { valid: false, error: "File is empty", columns: [], rowCount: 0 };
    }

    const columns = parseColumns(lines[0]);

    if (columns.length === 0) {
      return { valid: false, error: "Could not parse CSV headers", columns: [], rowCount: 0 };
    }

    if (columns.length === 1 && !lines[0].includes(",") && !lines[0].includes(";")) {
      return {
        valid: false,
        error: "File does not appear to be a valid CSV (no delimiter found)",
        columns: [],
        rowCount: 0,
      };
    }

    // Count all data rows (total lines minus header)
    const totalLines = await countLines(filePath);
    const rowCount = Math.max(0, totalLines - 1); // exclude header

    return { valid: true, columns, rowCount, columnCount: columns.length };
  } catch (err) {
    return { valid: false, error: `Failed to parse file: ${err.message}`, columns: [], rowCount: 0 };
  }
};

module.exports = { validateCSV, parseColumns, readLines, countLines };
