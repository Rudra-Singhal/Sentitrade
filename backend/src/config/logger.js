const pino = require("pino");
const { env, isDev, isTest } = require("./env");

// Redact anything that could carry a secret. `*.foo` matches `foo` at any depth.
const redact = {
  paths: [
    "req.headers.authorization",
    "req.headers.cookie",
    'req.headers["x-api-key"]',
    "MONGODB_URI",
    "NEWS_API_KEY",
    "*.MONGODB_URI",
    "*.NEWS_API_KEY",
    "*.apiKey",
    "*.apikey",
    "*.api_key",
    "*.password",
    "*.token",
    "*.authorization"
  ],
  censor: "[redacted]"
};

const logger = pino({
  level: isTest ? "silent" : env.LOG_LEVEL,
  redact,
  base: { env: env.NODE_ENV },
  transport: isDev
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname,env" }
      }
    : undefined
});

/**
 * Collapse an arbitrary thrown value into a safe, structured shape.
 * Never returns URLs, config objects, request/response bodies, or stack-free secrets.
 */
const errInfo = (err) => {
  if (!err || typeof err !== "object") return { message: String(err) };

  return {
    message: err.message || "unknown error",
    name: err.name,
    code: err.code,
    status: err.response?.status ?? err.status
  };
};

module.exports = logger;
module.exports.errInfo = errInfo;
