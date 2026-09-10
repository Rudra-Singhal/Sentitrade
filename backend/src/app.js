const { env } = require("./config/env");
const logger = require("./config/logger");
const { errInfo } = logger;

const cors = require("cors");
const compression = require("compression");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");

const { corsOptions } = require("./config/cors");
const { captureException } = require("./config/sentry");
const healthRoutes = require("./routes/healthRoutes");
const sentimentRoutes = require("./routes/sentimentRoutes");
const correlationRoutes = require("./routes/correlationRoutes");
const assetRoutes = require("./routes/assetRoutes");

// Pure Express app — no DB connection, no listener, no scheduler. `server.js`
// wires those up for the real process; tests import this directly.
const app = express();

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
  res.json({
    name: "SentiTrade API",
    status: "running",
    health: "/api/health",
    ready: "/api/ready"
  });
});

// Ops endpoints stay unversioned; data endpoints are versioned.
app.use("/api", healthRoutes);
app.use("/api/v1", assetRoutes);
app.use("/api/v1", sentimentRoutes);
app.use("/api/v1", correlationRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, _req, res, _next) => {
  const isCors = error.message?.startsWith("CORS blocked");
  const status = isCors ? 403 : error.status || 500;

  logger.error({ err: errInfo(error), status }, "request failed");
  if (status >= 500) captureException(error);

  res.status(status).json({
    message:
      status === 403
        ? "Origin not allowed"
        : status >= 500
          ? "Internal server error"
          : error.message || "Request failed"
  });
});

module.exports = app;
