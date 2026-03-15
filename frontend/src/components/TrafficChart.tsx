import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type { TimelineBucket } from "../hooks/useStats";

interface TrafficChartProps {
  timeline: TimelineBucket[];
}

export function TrafficChart({ timeline }: TrafficChartProps) {
  const data = timeline.map((bucket) => ({
    time: new Date(bucket.ts * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    ts: bucket.ts,
    bytes: bucket.bytes,
    flows: bucket.flows,
    alerts: bucket.alerts,
  }));

  // Create reference lines for alert bursts (buckets with >5 alerts)
  const alertBuckets = data.filter((d) => d.alerts > 5);

  return (
    <div className="rounded-lg border border-gray-800 bg-surface-card p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-300">
        Traffic Timeline (last 10 min)
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="gradBytes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradFlows" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
          <XAxis
            dataKey="time"
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            label={{
              value: "Bytes",
              angle: -90,
              position: "insideLeft",
              fill: "#6b7280",
              fontSize: 10,
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            label={{
              value: "Flows",
              angle: 90,
              position: "insideRight",
              fill: "#6b7280",
              fontSize: 10,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#161922",
              border: "1px solid #2d3348",
              borderRadius: "6px",
              fontSize: "11px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "11px", color: "#9ca3af" }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="bytes"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#gradBytes)"
            dot={false}
            name="Bytes"
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="flows"
            stroke="#22c55e"
            strokeWidth={1.5}
            fill="url(#gradFlows)"
            dot={false}
            name="Flows"
          />
          {alertBuckets.map((b) => (
            <ReferenceLine
              key={b.ts}
              x={b.time}
              yAxisId="left"
              stroke="#ef4444"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
