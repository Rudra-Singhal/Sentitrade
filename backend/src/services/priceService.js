const { normalizeAsset } = require("./assetService");
const { makeMockPriceSeries } = require("./mockDataService");
const { toMinutes } = require("./newsService");
const { providerFor } = require("../pricing");
const { livePriceEnabled } = require("../config/env");
const logger = require("../config/logger");
const { errInfo } = logger;
const metrics = require("../lib/metrics");
const { syntheticOrNull } = require("../lib/fallback");
const { DATA_SOURCE } = require("../lib/dataSource");

const priceCache = new Map();
const CACHE_MS = 60_000;

/**
 * @returns {{ series: {timestamp,price}[], price_source: string }}
 */
const getPriceSeries = async (asset = "BTC", range = "1h") => {
  const assetConfig = normalizeAsset(asset);
  const minutes = toMinutes(range);
  const cacheKey = `${assetConfig.symbol}:${range}`;

  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return { series: cached.series, price_source: cached.price_source };
  }

  const provider = providerFor(assetConfig);
  if (livePriceEnabled && provider) {
    try {
      const sinceMs = Date.now() - minutes * 60 * 1000;
      const { series, price_source } = await provider.fetch(assetConfig, range, sinceMs);
      if (series.length >= 2) {
        priceCache.set(cacheKey, { at: Date.now(), series, price_source });
        metrics.inc(`price_fetch_total:${provider.id}:ok`);
        metrics.markTimestamp(`last_price_fetch_ok_at:${provider.id}`);
        return { series, price_source };
      }
      metrics.inc(`price_fetch_total:${provider.id}:empty`);
    } catch (err) {
      metrics.inc(`price_fetch_total:${provider.id}:error`);
      logger.warn(
        { asset: assetConfig.symbol, provider: provider.id, err: errInfo(err) },
        "price provider failed"
      );
    }
  }

  const mock = syntheticOrNull("price", () =>
    makeMockPriceSeries(assetConfig, Math.min(minutes, 240))
  );
  if (mock) {
    priceCache.set(cacheKey, { at: Date.now(), series: mock, price_source: DATA_SOURCE.SIMULATED });
    return { series: mock, price_source: DATA_SOURCE.SIMULATED };
  }

  return { series: [], price_source: DATA_SOURCE.UNAVAILABLE };
};

const getPriceChange = async (asset = "BTC", range = "1h") => {
  const { series, price_source } = await getPriceSeries(asset, range);

  if (series.length < 2) {
    return {
      series: [],
      current_price: null,
      price_change: null,
      price_source: DATA_SOURCE.UNAVAILABLE
    };
  }

  const first = series[0]?.price || 0;
  const last = series[series.length - 1]?.price || first;
  const change = first ? ((last - first) / first) * 100 : 0;

  return {
    series,
    current_price: last,
    price_change: Number(change.toFixed(2)),
    price_source
  };
};

module.exports = { getPriceSeries, getPriceChange };
