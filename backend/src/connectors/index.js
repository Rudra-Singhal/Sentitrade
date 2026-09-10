const newsapi = require("./newsapi");

// Registry of every source connector. Add a module here and the pipeline,
// scheduler and serving layers pick it up with no further changes.
// M1.3 adds finnhub + rss; M2 adds stocktwits, reddit, edgar.
const ALL = [newsapi];

/** Connectors that are enabled (env-configured) and match the given source types. */
const enabledConnectors = (types) =>
  ALL.filter((c) => c.enabled && (!types || types.includes(c.sourceType)));

const allConnectors = () => ALL;

module.exports = { enabledConnectors, allConnectors };
