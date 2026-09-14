const axios = require("axios");
const axiosRetry = require("axios-retry").default || require("axios-retry");
const CircuitBreaker = require("opossum");
const logger = require("../config/logger");
const { errInfo } = logger;
const metrics = require("./metrics");

/**
 * Build a per-provider HTTP client: retry with exponential backoff on
 * transient errors, wrapped in a circuit breaker so a failing provider is
 * skipped for a cooldown instead of hammered. One breaker per provider id.
 */
const createProviderClient = (id, { timeout = 9000, retries = 2 } = {}) => {
  const client = axios.create({ timeout });

  axiosRetry(client, {
    retries,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) =>
      axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429
  });

  const breaker = new CircuitBreaker((config) => client.request(config), {
    timeout: timeout + 2000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 5,
    name: id
  });

  breaker.on("open", () => {
    metrics.inc(`provider_breaker_open_total:${id}`);
    logger.warn({ provider: id }, "provider circuit breaker opened");
  });
  breaker.on("halfOpen", () => logger.info({ provider: id }, "provider circuit breaker half-open"));
  breaker.on("close", () => logger.info({ provider: id }, "provider circuit breaker closed"));

  return {
    id,
    get: (url, config = {}) => breaker.fire({ ...config, method: "get", url }),
    breaker,
    isOpen: () => breaker.opened,
    healthcheck: async (url) => {
      try {
        await breaker.fire({ method: "get", url, timeout });
        return { ok: true };
      } catch (err) {
        return { ok: false, detail: errInfo(err).message };
      }
    }
  };
};

module.exports = { createProviderClient };
