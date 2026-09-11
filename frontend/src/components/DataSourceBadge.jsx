import { describeSource, formatAsOf } from "../lib/dataSource.js";

const toneClasses = {
  positive: "border-neon/30 bg-neon/10 text-neon",
  info: "border-cyanline/30 bg-cyanline/10 text-cyanline",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  neutral: "border-white/15 bg-white/5 text-slate-300"
};

const DataSourceBadge = ({ source, asOf, className = "" }) => {
  if (!source) return null;
  const { text, tone, help } = describeSource(source);
  const age = formatAsOf(asOf);

  return (
    <span
      title={help}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${toneClasses[tone]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {text}
      {age ? <span className="font-medium normal-case opacity-80">· {age}</span> : null}
    </span>
  );
};

export default DataSourceBadge;
