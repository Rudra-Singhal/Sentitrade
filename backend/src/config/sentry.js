const { env, isProd } = require("./env");
const logger = require("./logger");

let enabled = false;

const initSentry = () => {
  if (!env.SENTRY_DSN) return;
  try {
    const Sentry = require("@sentry/node");
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: isProd ? 0.1 : 1.0,
      // Never ship request bodies / headers to Sentry.
      sendDefaultPii: false
    });
    enabled = true;
    logger.info("Sentry initialised");
  } catch (err) {
    logger.warn({ err: err.message }, "Sentry init failed");
  }
};

const captureException = (error, context) => {
  if (!enabled) return;
  require("@sentry/node").captureException(error, context ? { extra: context } : undefined);
};

const flushSentry = async () => {
  if (!enabled) return;
  try {
    await require("@sentry/node").flush(2000);
  } catch {
    /* best effort */
  }
};

module.exports = { initSentry, captureException, flushSentry };
