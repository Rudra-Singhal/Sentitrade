import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from "chart.js";
import { Line } from "react-chartjs-2";
import Card from "./Card.jsx";
import DataSourceBadge from "./DataSourceBadge.jsx";
import { DATA_SOURCE } from "../lib/dataSource.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const timeLabel = (timestamp) =>
  new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
    new Date(timestamp)
  );

const SentimentChart = ({ points = [], source }) => {
  const labels = points.map((point) => timeLabel(point.timestamp));
  const values = points.map((point) => point.sentiment_percent);

  const data = {
    labels,
    datasets: [
      {
        label: "News tone %",
        data: values,
        borderColor: "#39FF88",
        backgroundColor: "rgba(57, 255, 136, 0.12)",
        pointBackgroundColor: "#58D5FF",
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: true,
        tension: 0.35,
        borderWidth: 2
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "rgba(5,7,10,0.94)",
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: { color: "rgba(226,232,240,0.5)", maxTicksLimit: 6 }
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: { color: "rgba(226,232,240,0.5)" }
      }
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Trend</p>
          <h2 className="mt-1 text-xl font-bold text-white">News Tone Over Time</h2>
          <DataSourceBadge source={source} className="mt-2" />
        </div>
      </div>
      <div className="h-[300px]">
        {points.length >= 2 ? (
          <Line
            data={data}
            options={options}
            aria-label={`News tone over time, currently ${values[values.length - 1] ?? "unknown"} percent`}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-black/20 text-sm text-slate-400">
            {source === DATA_SOURCE.UNAVAILABLE
              ? "Trend data is unavailable right now."
              : "Not enough data points to plot a trend yet."}
          </div>
        )}
      </div>
    </Card>
  );
};

export default SentimentChart;
