const { createProviderClient } = require("../lib/httpClient");
const logger = require("../config/logger");
const { errInfo } = logger;

const client = createProviderClient("edgar", { timeout: 9000, retries: 2 });

// SEC requires a descriptive User-Agent with contact info.
const USER_AGENT = "SentiTrade educational project (contact: github.com/Rudra-Singhal/Sentitrade)";

// Central Index Keys (zero-padded to 10 digits) for the equity universe.
const CIK = {
  AAPL: "0000320193",
  MSFT: "0000789019",
  GOOGL: "0001652044",
  AMZN: "0001018724",
  NVDA: "0001045810",
  META: "0001326801",
  TSLA: "0001318605",
  NFLX: "0001065280",
  AMD: "0000002488",
  INTC: "0000050863",
  JPM: "0000019617",
  V: "0001403161",
  DIS: "0001744489",
  PYPL: "0001633917",
  UBER: "0001543151"
};

const FORMS = new Set(["8-K", "10-Q", "10-K", "4"]);

const ITEM_LABELS = {
  1.01: "Material definitive agreement",
  1.03: "Bankruptcy or receivership",
  2.02: "Results of operations (earnings)",
  2.03: "New direct financial obligation",
  3.01: "Notice of delisting",
  4.01: "Change of accountant",
  5.02: "Executive or director change",
  7.01: "Regulation FD disclosure",
  8.01: "Other event"
};

const eventFor = (form, itemsStr) => {
  const items = String(itemsStr || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (form === "8-K") {
    if (items.includes("2.02")) return { type: "earnings", impact: 0.8 };
    if (items.includes("1.03") || items.includes("3.01")) return { type: "distress", impact: 0.9 };
    if (items.includes("5.02")) return { type: "executive_change", impact: 0.6 };
    if (items.includes("1.01")) return { type: "material_agreement", impact: 0.5 };
    return { type: "disclosure", impact: 0.3 };
  }
  if (form === "10-K") return { type: "annual_report", impact: 0.6 };
  if (form === "10-Q") return { type: "quarterly_report", impact: 0.5 };
  if (form === "4") return { type: "insider_transaction", impact: 0.4 };
  return { type: "filing", impact: 0.3 };
};

/** Pure: SEC submissions.recent parallel arrays -> connector docs. */
const mapFilings = (recent, company, sinceMs, limit) => {
  if (!recent || !Array.isArray(recent.form)) return [];
  const out = [];
  for (let i = 0; i < recent.form.length && out.length < limit; i += 1) {
    const form = recent.form[i];
    if (!FORMS.has(form)) continue;

    const filedIso = recent.filingDate[i];
    const filedMs = filedIso ? new Date(`${filedIso}T12:00:00Z`).getTime() : Date.now();
    if (Number.isFinite(filedMs) && filedMs < sinceMs) continue;

    const items = recent.items?.[i];
    const ev = eventFor(form, items);
    const itemText = String(items || "")
      .split(/[,;]/)
      .map((s) => ITEM_LABELS[s.trim()])
      .filter(Boolean)
      .join("; ");

    out.push({
      text: `${company} filed a ${form}${itemText ? ` — ${itemText}` : ""} with the SEC.`,
      title: `${company} ${form} filing`,
      url: recent.accessionNumber?.[i]
        ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=${form}`
        : null,
      external_id: `edgar:${recent.accessionNumber?.[i] || `${company}-${form}-${filedIso}`}`,
      published_at: filedIso ? `${filedIso}T12:00:00.000Z` : null,
      event: ev,
      provider_meta: { source_name: "SEC EDGAR", form, items: items || null }
    });
  }
  return out;
};

/** @type {import("./types").SourceConnector} */
const edgarConnector = {
  id: "edgar",
  sourceType: "filing",
  cadenceSeconds: 900,
  enabled: true,
  appliesTo: (asset) => Boolean(CIK[asset.symbol]),

  async fetch({ asset, since, limit = 15 }) {
    const cik = CIK[asset.symbol];
    if (!cik) return [];
    const sinceMs = since ? new Date(since).getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000; // filings are sparse — look back a month

    const res = await client.get(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { "User-Agent": USER_AGENT }
    });
    return mapFilings(res.data?.filings?.recent, asset.displayName, sinceMs, limit);
  },

  async healthcheck() {
    try {
      await client.get("https://data.sec.gov/submissions/CIK0000320193.json", {
        headers: { "User-Agent": USER_AGENT }
      });
      return { ok: true };
    } catch (err) {
      logger.warn({ err: errInfo(err) }, "edgar healthcheck failed");
      return { ok: false, detail: errInfo(err).message };
    }
  }
};

module.exports = edgarConnector;
module.exports.mapFilings = mapFilings;
module.exports.eventFor = eventFor;
