const { env } = require("./config/env");
const logger = require("./config/logger");
const { errInfo } = logger;

const cors = require("cors");
const compression = require("compression");
const express = require("express");
const helmet = require("helmet");
const http = require("http");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");

const connectDB = require("./config/db");
const { corsOptions } = require("./config/cors");
const initSocket = require("./services/socketService");
const healthRoutes = require("./routes/healthRoutes");
const sentimentRoutes = require("./routes/sentimentRoutes");
const correlationRoutes = require("./routes/correlationRoutes");
const assetRoutes = require("./routes/assetRoutes");

const app = express();
const server = http.createServer(app);

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === "/api/health" }
  })
);
app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: env.RATE_LIMIT_PER_MINUTE,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/", (_req, res) => {
  res.json({ name: "SentiTrade API", status: "running", health: "/api/health", ready: "/api/ready" });
});

app.use("/api", healthRoutes);
app.use("/api", assetRoutes);
app.use("/api", sentimentRoutes);
app.use("/api", correlationRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  const isCors = error.message?.startsWith("CORS blocked");
  const status = isCors ? 403 : error.status || 500;

  logger.error({ err: errInfo(error), status }, "request failed");

  res.status(status).json({
    message:
      status === 403
        ? "Origin not allowed"
        : status >= 500
          ? "Internal server error"
          : error.message || "Request failed"
  });
});

let io;

const start = async () => {
  await connectDB();
  io = initSocket(server);
  server.listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV }, "server listening"));
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
    if (io) await io.close();
    server.close();
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close(false);
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
process.on("unhandledRejection", (reason) => logger.error({ err: errInfo(reason) }, "unhandledRejection"));
process.on("uncaughtException", (err) => {
  logger.fatal({ err: errInfo(err) }, "uncaughtException");
  shutdown("uncaughtException");
});

module.exports = { app, server };
