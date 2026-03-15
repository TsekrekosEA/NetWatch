import type { Alert } from "../hooks/useAlertStream";

interface FlowTableProps {
  alerts: Alert[];
  limit?: number;
}

export function FlowTable({ alerts, limit = 100 }: FlowTableProps) {
  const rows = alerts.slice(0, limit);

  return (
    <div className="overflow-auto rounded-lg border border-gray-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-card text-gray-500">
          <tr>
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Destination</th>
            <th className="px-3 py-2">Proto</th>
            <th className="px-3 py-2">Bytes</th>
            <th className="px-3 py-2">Severity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr
              key={a.id}
              className="border-t border-gray-800/50 hover:bg-surface-hover"
            >
              <td className="px-3 py-1.5 text-gray-500">
                {new Date(a.timestamp * 1000).toLocaleTimeString()}
              </td>
              <td className="px-3 py-1.5 font-mono text-gray-300">
                {a.src_ip}:{a.src_port ?? "—"}
              </td>
              <td className="px-3 py-1.5 font-mono text-gray-300">
                {a.dst_ip}:{a.dst_port ?? "—"}
              </td>
              <td className="px-3 py-1.5 text-gray-400">{a.protocol}</td>
              <td className="px-3 py-1.5 text-gray-400">
                {a.total_bytes?.toLocaleString() ?? "—"}
              </td>
              <td className="px-3 py-1.5">
                <span
                  className={`text-[10px] font-bold ${
                    a.severity === "CRITICAL"
                      ? "text-red-400"
                      : a.severity === "HIGH"
                      ? "text-orange-400"
                      : a.severity === "MEDIUM"
                      ? "text-amber-400"
                      : "text-gray-400"
                  }`}
                >
                  {a.severity}
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-gray-600">
                No flows yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
