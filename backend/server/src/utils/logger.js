/**
 * src/utils/logger.js
 * ────────────────────
 * Thin wrapper around console that adds timestamps and log-level prefixes.
 * Swap this out for Winston / Pino in production without changing call sites.
 */

const isDev = process.env.NODE_ENV !== "production";

const timestamp = () => new Date().toISOString();

const logger = {
  info: (...args) => console.log(`[${timestamp()}] INFO `, ...args),
  warn: (...args) => console.warn(`[${timestamp()}] WARN `, ...args),
  error: (...args) => console.error(`[${timestamp()}] ERROR`, ...args),
  debug: (...args) => {
    if (isDev) console.debug(`[${timestamp()}] DEBUG`, ...args);
  },
};

module.exports = logger;
