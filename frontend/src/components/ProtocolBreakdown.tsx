import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface ProtocolBreakdownProps {
  distribution: Record<string, number>;
}

const COLORS: Record<string, string> = {
  TCP: "#3b82f6",
  UDP: "#22c55e",
  ICMP: "#f59e0b",
  OTHER: "#6b7280",
};

export function ProtocolBreakdown({ distribution }: ProtocolBreakdownProps) {
  const data = Object.entries(distribution)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-gray-800 bg-surface-card text-sm text-gray-500">
        No protocol data yet
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-surface-card p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-300">
        Protocol Distribution (1h)
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={75}
            label={({ name, percent, x, y }) => (
              <text
                x={x}
                y={y}
                fill="#d1d5db"
                fontSize={11}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {`${name} ${(percent * 100).toFixed(0)}%`}
              </text>
            )}
            labelLine={{ stroke: "#4b5563" }}
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name] ?? COLORS.OTHER}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#161922",
              border: "1px solid #2d3348",
              borderRadius: "6px",
              fontSize: "11px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
