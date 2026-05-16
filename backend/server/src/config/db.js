/**
 * src/config/db.js
 * ────────────────
 * Establishes a single Mongoose connection to MongoDB.
 * Called once at startup (server.js). Returns a promise so the server
 * only begins accepting requests after the database is ready.
 */

const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    logger.error("MONGO_URI is not defined in environment variables");
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      // Mongoose 7+ has these as defaults but being explicit is good practice
      serverSelectionTimeoutMS: 5000, // Fail fast if MongoDB is unreachable
      socketTimeoutMS: 45000,
    });

    logger.info(`✅  MongoDB connected → ${conn.connection.host} / ${conn.connection.name}`);

    // Log any future disconnections (e.g., MongoDB Atlas free-tier sleep)
    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected — attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
    });

    return conn;
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1); // Crash the process — nothing works without the DB
  }
};

module.exports = connectDB;
