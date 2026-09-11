import Card from "./Card.jsx";
import DataSourceBadge from "./DataSourceBadge.jsx";
import { Activity, FileText, Flame, Users } from "lucide-react";

const fmtAgo = (iso) => {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

const fgTone = (value) => {
  if (value == null) return "text-slate-400";
  if (value >= 60) return "text-neon";
  if (value <= 40) return "text-danger";
  return "text-warning";
};

const eventTone = {
  earnings: "text-cyanline",
  distress: "text-danger",
  executive_change: "text-warning",
  insider_transaction: "text-slate-300"
};

const Tile = ({ children }) => (
  <div className="rounded-lg border border-white/10 bg-black/20 p-4">{children}</div>
);

const MarketContext = ({ sentiment }) => {
  const fg = sentiment?.context?.fear_greed;
  const attention = sentiment?.context?.attention;
  const social = sentiment?.social;
  const divergence = sentiment?.news_retail_divergence;
  const events = sentiment?.events || [];

  const crowdVsNews =
    divergence == null
      ? null
      : Math.abs(divergence) < 5
        ? "Retail and news are broadly aligned."
        : divergence > 0
          ? `News tone is ${divergence} pts more positive than retail chatter.`
          : `Retail chatter is ${Math.abs(divergence)} pts more positive than the news.`;

  return (
    <Card className="p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Context</p>
        <h2 className="mt-1 text-xl font-bold text-white">Market Context</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile>
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              <Flame size={13} /> Fear &amp; Greed
            </span>
            {fg?.source ? <span className="text-[10px] text-slate-500">{fg.source}</span> : null}
          </div>
          <p className={`text-2xl font-extrabold ${fgTone(fg?.value)}`}>{fg?.value ?? "—"}</p>
          <p className="mt-1 text-xs text-slate-500">{fg?.label || "unavailable"}</p>
        </Tile>

        <Tile>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            <Activity size={13} /> Attention
          </div>
          <p className="text-2xl font-extrabold text-white">
            {attention?.ratio ? `${attention.ratio}×` : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {attention?.ratio ? "vs typical Wikipedia views" : "unavailable"}
          </p>
        </Tile>

        <Tile>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            <Users size={13} /> Retail tone
          </div>
          <p className="text-2xl font-extrabold text-white">
            {social?.score_percent != null ? `${social.score_percent}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {social?.count
              ? `${social.count} posts · bull/bear ${social.bull_bear_ratio}`
              : "unavailable"}
          </p>
        </Tile>
      </div>

      {crowdVsNews ? (
        <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
          {crowdVsNews}
        </p>
      ) : null}

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          <FileText size={13} /> Recent filings &amp; events
        </div>
        {events.length === 0 ? (
          <p className="text-xs text-slate-500">No recent filings or classified events.</p>
        ) : (
          <ul className="space-y-1.5">
            {events.slice(0, 5).map((e, i) => (
              <li
                key={`${e.type}-${e.at}-${i}`}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className={`font-semibold ${eventTone[e.type] || "text-slate-300"}`}>
                  {String(e.type || "event").replace(/_/g, " ")}
                </span>
                <span className="truncate text-slate-500">{e.title}</span>
                <span className="shrink-0 text-slate-600">{fmtAgo(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DataSourceBadge source={fg?.data_source || attention?.data_source} className="mt-4" />
    </Card>
  );
};

export default MarketContext;
