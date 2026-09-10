const http = require("http");
const mongoose = require("mongoose");
const { env } = require("./config/env");
const logger = require("./config/logger");
const { errInfo } = logger;
const { initSentry, flushSentry, captureException } = require("./config/sentry");

const app = require("./app");
const connectDB = require("./config/db");
const initSocket = require("./services/socketService");
const { startScheduler, stopScheduler } = require("./jobs/scheduler");

initSentry();

const server = http.createServer(app);
let io;

const start = async () => {
  await connectDB();
  io = initSocket(server);
  startScheduler();
  server.listen(env.PORT, () =>
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "server listening")
  );
};

start();

let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  const force = setTimeout(() => {
    logger.error("graceful shutdown timed out; forcing exit");
    process.exit(1);
  }, 10000);
  force.unref();

  try {
    stopScheduler();
    if (io) {
      io.stopBroadcast?.();
      await io.close();
    }
    server.close();
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close(false);
    await flushSentry();
    clearTimeout(force);
    logger.info("shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err: errInfo(err) }, "error during shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ err: errInfo(reason) }, "unhandledRejection");
  captureException(reason instanceof Error ? reason : new Error(String(reason)));
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err: errInfo(err) }, "uncaughtException");
  captureException(err);
  shutdown("uncaughtException");
});

module.exports = { app, server };
