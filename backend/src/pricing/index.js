const binance = require("./binance");
const yahoo = require("./yahoo");

const PROVIDERS = [binance, yahoo];

/** First provider that handles this asset type. */
const providerFor = (asset) => PROVIDERS.find((p) => p.appliesTo(asset)) || null;

const allProviders = () => PROVIDERS;

module.exports = { providerFor, allProviders };
