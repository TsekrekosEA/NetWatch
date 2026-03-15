import { useState, useRef, useEffect, useCallback } from "react";
import type { Alert } from "../hooks/useAlertStream";
import { SeverityBadge } from "./SeverityBadge";

interface AlertFeedProps {
  alerts: Alert[];
}

export function AlertFeed({ alerts }: AlertFeedProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Smart scroll lock: if user scrolls up, stop auto-scrolling
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setAutoScroll(el.scrollTop < 20);
  }, []);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [alerts.length, autoScroll]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto"
    >
      {alerts.length === 0 && (
        <div className="flex h-full items-center justify-center text-sm text-gray-500">
          Waiting for alerts…
        </div>
      )}

      {alerts.map((alert) => {
        const expanded = expandedId === alert.id;
        const ts = new Date(alert.timestamp * 1000);
        const timeStr = ts.toLocaleTimeString();

        return (
          <div
            key={alert.id}
            className="border-b border-gray-800/50 px-4 py-2 transition-colors hover:bg-surface-hover cursor-pointer"
            onClick={() => setExpandedId(expanded ? null : alert.id)}
          >
            <div className="flex items-center gap-3 text-sm">
              <span className="w-20 shrink-0 text-xs text-gray-500">
                {timeStr}
              </span>
              <SeverityBadge severity={alert.severity} />
              <span className="font-mono text-xs text-gray-300">
                {alert.src_ip}:{alert.src_port ?? "—"}
                <span className="mx-1 text-gray-600">→</span>
                {alert.dst_ip}:{alert.dst_port ?? "—"}
              </span>
              <span className="ml-auto text-xs text-gray-400">
                {alert.category}
              </span>
              <span
                className={`rounded px-1 text-[10px] ${
                  alert.stage === "both"
                    ? "bg-purple-900/40 text-purple-300"
                    : alert.stage === "ml"
                    ? "bg-blue-900/40 text-blue-300"
                    : "bg-gray-700/40 text-gray-400"
                }`}
              >
                {alert.stage}
              </span>
            </div>

            {expanded && (
              <div className="mt-2 rounded bg-surface p-3 text-xs text-gray-400">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <DetailRow label="Protocol" value={alert.protocol} />
                  <DetailRow
                    label="Duration"
                    value={
                      alert.flow_duration != null
                        ? `${alert.flow_duration.toFixed(3)}s`
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Total Bytes"
                    value={alert.total_bytes?.toLocaleString() ?? "—"}
                  />
                  <DetailRow
                    label="Total Packets"
                    value={alert.total_packets?.toLocaleString() ?? "—"}
                  />
                </div>
                {alert.details && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-900 p-2 text-[10px] leading-relaxed">
                    {JSON.stringify(alert.details, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono text-gray-300">{value}</span>
    </div>
  );
}
