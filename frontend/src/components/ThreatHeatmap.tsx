import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Alert } from "../hooks/useAlertStream";

interface ThreatHeatmapProps {
  alertsByCategory: Record<string, number>;
  alerts: Alert[];
}

export function ThreatHeatmap({
  alertsByCategory,
  alerts,
}: ThreatHeatmapProps) {
  // Build the IP × category matrix from recent alerts
  const { matrix, categories } = useMemo(() => {
    const cats = new Set<string>();
    const ipMap = new Map<string, Map<string, number>>();

    for (const a of alerts) {
      cats.add(a.category);
      if (!ipMap.has(a.src_ip)) ipMap.set(a.src_ip, new Map());
      const catMap = ipMap.get(a.src_ip)!;
      catMap.set(a.category, (catMap.get(a.category) ?? 0) + 1);
    }

    // Only top 10 IPs by total alerts
    const sorted = [...ipMap.entries()]
      .map(([ip, catMap]) => {
        let total = 0;
        for (const v of catMap.values()) total += v;
        return { ip, catMap, total };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const catList = [...cats].sort();
    const rows = sorted.map(({ ip, catMap }) => {
      const row: Record<string, string | number> = { ip };
      for (const c of catList) {
        row[c] = catMap.get(c) ?? 0;
      }
      return row;
    });

    return { matrix: rows, categories: catList };
  }, [alerts]);

  // Bar chart data for category breakdown
  const categoryData = Object.entries(alertsByCategory).map(([name, value]) => ({
    name: name.length > 15 ? name.slice(0, 12) + "…" : name,
    fullName: name,
    count: value,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Heatmap table */}
      <div className="rounded-lg border border-gray-800 bg-surface-card p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-300">
          Threat Matrix (Source IP × Category)
        </h3>
        {matrix.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-600">
            No threat data yet
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-gray-500">IP</th>
                  {categories.map((c) => (
                    <th
                      key={c}
                      className="px-2 py-1 text-center text-gray-500"
                      title={c}
                    >
                      {c.length > 10 ? c.slice(0, 8) + "…" : c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.ip as string} className="border-t border-gray-800/50">
                    <td className="px-2 py-1 font-mono text-gray-300">
                      {row.ip as string}
                    </td>
                    {categories.map((c) => {
                      const v = row[c] as number;
                      return (
                        <td key={c} className="px-2 py-1 text-center">
                          <span
                            className={`inline-block min-w-[24px] rounded px-1 ${
                              v === 0
                                ? "text-gray-700"
                                : v < 5
                                ? "bg-amber-900/30 text-amber-300"
                                : v < 20
                                ? "bg-orange-900/40 text-orange-300"
                                : "bg-red-900/50 text-red-300"
                            }`}
                          >
                            {v}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alerts by category bar chart */}
      <div className="rounded-lg border border-gray-800 bg-surface-card p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-300">
          Alerts by Category (1h)
        </h3>
        {categoryData.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-600">
            No category data yet
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryData} layout="vertical">
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e2130"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: "#6b7280", fontSize: 10 }}
                tickLine={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tick={{ fill: "#6b7280", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#161922",
                  border: "1px solid #2d3348",
                  borderRadius: "6px",
                  fontSize: "11px",
                }}
                labelFormatter={(_, payload) => {
                  if (payload?.[0]) {
                    const item = payload[0].payload as { fullName: string };
                    return item.fullName;
                  }
                  return "";
                }}
              />
              <Bar dataKey="count" fill="url(#barGrad)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
