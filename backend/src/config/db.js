const mongoose = require("mongoose");
const { env, isProd } = require("./env");
const logger = require("./logger");
const { errInfo } = logger;

let listenersBound = false;

const bindListeners = () => {
  if (listenersBound) return;
  listenersBound = true;

  mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));
  mongoose.connection.on("error", (err) => logger.error({ err: errInfo(err) }, "MongoDB error"));
};

const connectDB = async () => {
  if (!env.MONGODB_URI) {
    if (isProd) {
      logger.fatal("MONGODB_URI is required in production");
      process.exit(1);
    }
    logger.warn("MONGODB_URI not set — running without a database (development only)");
    return false;
  }

  bindListeners();

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10
    });
    return true;
  } catch (err) {
    logger.error({ err: errInfo(err) }, "MongoDB initial connection failed");
    if (isProd) {
      logger.fatal("Cannot start without MongoDB in production");
      process.exit(1);
    }
    return false;
  }
};

const isDbConnected = () => mongoose.connection.readyState === 1;

module.exports = connectDB;
module.exports.isDbConnected = isDbConnected;
