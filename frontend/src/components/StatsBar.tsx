import type { StatsSummary, HealthStatus } from "../hooks/useStats";

interface StatsBarProps {
  summary: StatsSummary;
  liveStats: { flows_last_minute: number; alerts_last_minute: number };
  health: HealthStatus | null;
}

export function StatsBar({ summary, liveStats, health }: StatsBarProps) {
  const mlLoaded = health?.ml_loaded ?? false;
  const sevCounts = summary.alerts_by_severity;
  const topTalker =
    summary.top_src_ips.length > 0 ? summary.top_src_ips[0].ip : "—";

  return (
    <div className="grid grid-cols-4 gap-3 border-b border-gray-800 bg-surface-card px-6 py-3">
      {/* Total flows */}
      <StatCard
        label="Flows (1h)"
        value={summary.total_flows_1h.toLocaleString()}
        sub={`${liveStats.flows_last_minute}/min`}
      />

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
      </div>

      {/* Top talker */}
      <StatCard label="Top Talker" value={topTalker} sub="most flows (1h)" />

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

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg bg-surface px-4 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-[10px] text-gray-500">{sub}</p>
    </div>
  );
}
