import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type { TimelineBucket } from "../hooks/useStats";
import type { Alert } from "../hooks/useAlertStream";

interface TrafficChartProps {
  timeline: TimelineBucket[];
  alerts: Alert[];
}

export function TrafficChart({ timeline, alerts }: TrafficChartProps) {
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
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
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
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="bytes"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Bytes"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="flows"
            stroke="#22c55e"
            strokeWidth={1.5}
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
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
