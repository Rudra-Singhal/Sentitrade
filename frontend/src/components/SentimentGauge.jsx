import Card from "./Card.jsx";
import DataSourceBadge from "./DataSourceBadge.jsx";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { DATA_SOURCE } from "../lib/dataSource.js";

const labelStyles = {
  positive: { color: "text-neon", ring: "stroke-neon", bg: "bg-neon/15", icon: TrendingUp },
  neutral: { color: "text-warning", ring: "stroke-warning", bg: "bg-warning/15", icon: Activity },
  negative: { color: "text-danger", ring: "stroke-danger", bg: "bg-danger/15", icon: TrendingDown }
};

const SentimentGauge = ({ data, loading }) => {
  const unavailable = data?.data_source === DATA_SOURCE.UNAVAILABLE;
  const label = data?.sentiment_label || "neutral";
  const score = data?.score_percent ?? 50;
  const styles = labelStyles[label] || labelStyles.neutral;
  const Icon = styles.icon;
  const circumference = 2 * Math.PI * 72;
  const shown = unavailable ? 0 : score;
  const offset = circumference - (shown / 100) * circumference;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Sentiment
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">{data?.asset || "BTC"} News Tone</h2>
          <DataSourceBadge source={data?.data_source} asOf={data?.as_of} className="mt-2" />
        </div>
        <div className={`rounded-lg ${styles.bg} p-2 ${styles.color}`}>
          <Icon size={20} />
        </div>
      </div>

      <div className="relative mx-auto h-44 w-44">
        <svg
          viewBox="0 0 180 180"
          className="-rotate-90"
          role="img"
          aria-label={`Sentiment ${unavailable ? "unavailable" : `${score} percent, ${label}`}`}
        >
          <circle
            cx="90"
            cy="90"
            r="72"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="14"
          />
          <circle
            cx="90"
            cy="90"
            r="72"
            fill="none"
            strokeWidth="14"
            strokeLinecap="round"
            className={styles.ring}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`text-4xl font-extrabold ${unavailable ? "text-slate-500" : styles.color}`}
          >
            {loading ? "--" : unavailable ? "—" : `${score}%`}
          </span>
          <span className="mt-1 rounded-full border border-white/10 px-3 py-1 text-xs font-bold uppercase text-slate-300">
            {unavailable ? "no live data" : label}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default SentimentGauge;
