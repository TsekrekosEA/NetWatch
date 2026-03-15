import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { StatsSummary, HealthStatus, TimelineBucket } from "../hooks/useStats";
import { SkeletonCard } from "./Skeleton";

interface StatsBarProps {
  summary: StatsSummary;
  liveStats: { flows_last_minute: number; alerts_last_minute: number };
  health: HealthStatus | null;
  loading: boolean;
  timeline: TimelineBucket[];
}

export function StatsBar({
  summary,
  liveStats,
  health,
  loading,
  timeline,
}: StatsBarProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 border-b border-gray-800 bg-surface-card px-6 py-3 sm:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const mlLoaded = health?.ml_loaded ?? false;
  const sevCounts = summary.alerts_by_severity;
  const topTalker =
    summary.top_src_ips.length > 0 ? summary.top_src_ips[0] : null;

  return (
    <div className="grid grid-cols-2 gap-3 border-b border-gray-800 bg-surface-card px-6 py-3 sm:grid-cols-4">
      {/* Total flows */}
      <div className="rounded-lg bg-surface px-4 py-2">
        <p className="text-xs text-gray-500">Flows (1h)</p>
        <p className="text-lg font-semibold text-white">
          {summary.total_flows_1h.toLocaleString()}
        </p>
        <p className="text-[10px] text-gray-500">
          {liveStats.flows_last_minute}/min
        </p>
        <MicroSparkline data={timeline} dataKey="flows" color="#3b82f6" />
      </div>

      {/* Active alerts */}
      <div className="rounded-lg bg-surface px-4 py-2">
        <p className="text-xs text-gray-500">Alerts (1h)</p>
        <p className="text-lg font-semibold text-white">
          {summary.total_alerts_1h.toLocaleString()}
        </p>
        <div className="mt-0.5 flex gap-2 text-[10px]">
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((s) => {
            const count = sevCounts[s] ?? 0;
            if (count === 0) return null;
            const color = {
              CRITICAL: "text-red-400",
              HIGH: "text-orange-400",
              MEDIUM: "text-amber-400",
              LOW: "text-gray-400",
            }[s];
            return (
              <span key={s} className={color}>
                {count} {s}
              </span>
            );
          })}
        </div>
        <MicroSparkline data={timeline} dataKey="alerts" color="#ef4444" />
      </div>

      {/* Top talker */}
      <div className="rounded-lg bg-surface px-4 py-2">
        <p className="text-xs text-gray-500">Top Talker</p>
        <p className="text-lg font-semibold text-white">
          {topTalker?.ip ?? "—"}
        </p>
        <p className="text-[10px] text-gray-500">
          {topTalker ? `${topTalker.count} flows (1h)` : "most flows (1h)"}
        </p>
      </div>

      {/* ML status */}
      <div className="rounded-lg bg-surface px-4 py-2">
        <p className="text-xs text-gray-500">ML Status</p>
        <p
          className={`text-lg font-semibold ${
            mlLoaded ? "text-green-400" : "text-amber-400"
          }`}
        >
          {mlLoaded ? "ML Active" : "Statistical Only"}
        </p>
        <p className="text-[10px] text-gray-500">
          {health
            ? `${health.flows_processed.toLocaleString()} flows processed`
            : "—"}
        </p>
      </div>
    </div>
  );
}

function MicroSparkline({
  data,
  dataKey,
  color,
}: {
  data: TimelineBucket[];
  dataKey: string;
  color: string;
}) {
  if (data.length < 2) return null;
  return (
    <div className="mt-1 h-6 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
