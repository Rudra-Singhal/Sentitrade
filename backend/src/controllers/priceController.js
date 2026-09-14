const { getPriceSeries } = require("../services/priceService");
const { normalizeAsset } = require("../services/assetService");

/**
 * Real OHLC price series for an asset — the data source for PriceChart.jsx,
 * which draws its own candlesticks instead of depending on TradingView's
 * embed (which doesn't carry NSE data at all; see M3.8 fix).
 *
 * Every point already carries open/high/low/close from the underlying
 * provider (pricing/yahoo.js, pricing/binance.js) — this endpoint is a thin
 * read over priceService's existing cache, not a new fetch path.
 */
const getPrice = async (req, res) => {
  const { asset, range } = req.validatedQuery;
  const { series, price_source } = await getPriceSeries(asset, range);
  res.json({ asset: normalizeAsset(asset).symbol, range, series, data_source: price_source });
};

module.exports = { getPrice };
