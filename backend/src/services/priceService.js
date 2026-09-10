const axios = require("axios");
const { normalizeAsset } = require("./assetService");
const { makeMockPriceSeries } = require("./mockDataService");
const { toMinutes } = require("./newsService");
const { livePriceEnabled } = require("../config/env");
const logger = require("../config/logger");
const { errInfo } = logger;
const metrics = require("../lib/metrics");
const { syntheticOrNull } = require("../lib/fallback");
const { DATA_SOURCE } = require("../lib/dataSource");

const priceCache = new Map();

const fetchCryptoSeries = async (assetConfig, range) => {
  const minutes = toMinutes(range);
  const url = `https://api.coingecko.com/api/v3/coins/${assetConfig.coingeckoId}/market_chart`;

  const response = await axios.get(url, {
    timeout: 8000,
    params: { vs_currency: "usd", days: 1 }
  });

  const prices = response.data?.prices || [];
  const since = Date.now() - minutes * 60 * 1000;

  return prices
    .filter(([timestamp]) => timestamp >= since)
    .map(([timestamp, price]) => ({
      timestamp: new Date(timestamp).toISOString(),
      price: Number(price.toFixed(2))
    }));
};

/**
 * @returns {{ series: object[], price_source: string }}
 */
const getPriceSeries = async (asset = "BTC", range = "1h") => {
  const assetConfig = normalizeAsset(asset);
  const minutes = toMinutes(range);
  const cacheKey = `${assetConfig.symbol}:${range}`;
  const cached = priceCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < 60000) {
    return { series: cached.series, price_source: cached.price_source };
  }

  if (livePriceEnabled && assetConfig.type === "crypto" && assetConfig.coingeckoId) {
    try {
      const series = await fetchCryptoSeries(assetConfig, range);
      if (series.length >= 2) {
        priceCache.set(cacheKey, { timestamp: Date.now(), series, price_source: DATA_SOURCE.LIVE });
        metrics.inc("price_fetch_total:ok");
        metrics.markTimestamp("last_price_fetch_ok_at");
        return { series, price_source: DATA_SOURCE.LIVE };
      }
    } catch (err) {
      metrics.inc("price_fetch_total:error");
      logger.warn({ asset: assetConfig.symbol, err: errInfo(err) }, "price provider unavailable");
    }
  }

  const mock = syntheticOrNull("price", () =>
    makeMockPriceSeries(assetConfig, Math.min(minutes, 240))
  );

  if (mock) {
    priceCache.set(cacheKey, {
      timestamp: Date.now(),
      series: mock,
      price_source: DATA_SOURCE.SIMULATED
    });
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
