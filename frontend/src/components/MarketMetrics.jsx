import { Activity, BarChart3, Gauge, Newspaper, TrendingDown, TrendingUp } from "lucide-react";
import Card from "./Card.jsx";
import DataSourceBadge from "./DataSourceBadge.jsx";
import Disclaimer from "./Disclaimer.jsx";

const toneClasses = {
  positive: "text-neon bg-neon/10 border-neon/20",
  neutral: "text-warning bg-warning/10 border-warning/20",
  negative: "text-danger bg-danger/10 border-danger/20",
  info: "text-cyanline bg-cyanline/10 border-cyanline/20"
};

const strengthLabel = { low: "Weak", moderate: "Moderate", high: "Strong" };

const getHeadlineStats = (items = []) => {
  const total = items.length || 0;
  const counts = items.reduce(
    (acc, item) => {
      acc[item.sentiment_label] = (acc[item.sentiment_label] || 0) + 1;
      return acc;
    },
    { positive: 0, neutral: 0, negative: 0 }
  );

  return {
    total,
    positive: total ? Math.round((counts.positive / total) * 100) : 0,
    neutral: total ? Math.round((counts.neutral / total) * 100) : 0,
    negative: total ? Math.round((counts.negative / total) * 100) : 0,
    counts
  };
};

const getMomentum = (points = []) => {
  if (points.length < 2) return null;
  const first = points[0].sentiment_percent ?? 50;
  const last = points[points.length - 1].sentiment_percent ?? first;
  return Number((last - first).toFixed(1));
};

const signed = (value, suffix = "%") => {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number}${suffix}`;
};

const signalStyles = {
  BUY: { border: "border-neon/25", bg: "bg-neon/10", text: "text-neon", icon: TrendingUp },
  SELL: { border: "border-danger/25", bg: "bg-danger/10", text: "text-danger", icon: TrendingDown },
  HOLD: { border: "border-warning/25", bg: "bg-warning/10", text: "text-warning", icon: Activity }
};

const MetricTile = ({ icon: Icon, label, value, helper, tone = "info" }) => (
  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className={`rounded-md border p-2 ${toneClasses[tone]}`}>
        <Icon size={16} />
      </div>
    </div>
    <p className="text-2xl font-extrabold text-white">{value}</p>
    <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
  </div>
);

const MarketMetrics = ({ sentiment, trend = [], correlation }) => {
  const items = sentiment?.items || [];
  const stats = getHeadlineStats(items);
  const momentum = getMomentum(trend);
  const priceMove = correlation?.price_change ?? null;
  const signal = sentiment?.signal || correlation?.signal;
  const signalStyle = signalStyles[signal?.signal] || signalStyles.HOLD;
  const SignalIcon = signalStyle.icon;
  const momentumTone = momentum === null ? "info" : momentum > 0 ? "positive" : momentum < 0 ? "negative" : "neutral";
  const priceTone = priceMove === null ? "info" : priceMove > 0 ? "positive" : priceMove < 0 ? "negative" : "neutral";

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Metrics</p>
          <h2 className="mt-1 text-xl font-bold text-white">Market Snapshot</h2>
          <DataSourceBadge source={sentiment?.data_source} asOf={sentiment?.as_of} className="mt-2" />
        </div>
      </div>

      <div className={`mb-4 rounded-lg border p-4 ${signalStyle.border} ${signalStyle.bg}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Illustrative signal
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <p className={`text-4xl font-extrabold ${signalStyle.text}`}>{signal?.signal || "HOLD"}</p>
              <p className="pb-1 text-sm font-semibold text-slate-300">
                {strengthLabel[signal?.strength] || "Weak"} signal alignment
              </p>
            </div>
          </div>
          <div className={`rounded-lg border p-3 ${signalStyle.border} ${signalStyle.text}`}>
            <SignalIcon size={22} />
          </div>
        </div>

        <div className="mt-3 space-y-1">
          {(signal?.reasons || ["Not enough data to lean either way."]).map((reason) => (
            <p key={reason} className="text-xs leading-5 text-slate-300">
              {reason}
            </p>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricTile
          icon={Newspaper}
          label="News Volume"
          value={stats.total}
          helper="Headlines analyzed for this asset"
          tone="info"
        />
        <MetricTile
          icon={Gauge}
          label="Positive Ratio"
          value={stats.total ? `${stats.positive}%` : "—"}
          helper={`${stats.counts.positive} positive of ${stats.total || 0} headlines`}
          tone={stats.positive >= 50 ? "positive" : "neutral"}
        />
        <MetricTile
          icon={TrendingUp}
          label="News Tone Move"
          value={signed(momentum, " pts")}
          helper="Change from first to latest trend point"
          tone={momentumTone}
        />
        <MetricTile
          icon={BarChart3}
          label="Price Move"
          value={signed(priceMove)}
          helper="Price change over the selected window"
          tone={priceTone}
        />
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Headline Mix</p>
          <p className="text-xs font-semibold text-slate-400">{correlation?.insight || "Waiting for data"}</p>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
          <div className="bg-neon" style={{ width: `${stats.positive}%` }} />
          <div className="bg-warning" style={{ width: `${stats.neutral}%` }} />
          <div className="bg-danger" style={{ width: `${stats.negative}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-slate-400">
          <span className="text-neon">Positive {stats.positive}%</span>
          <span className="text-warning">Neutral {stats.neutral}%</span>
          <span className="text-danger">Negative {stats.negative}%</span>
        </div>
      </div>

      <Disclaimer variant="inline" />
    </Card>
  );
};

export default MarketMetrics;
