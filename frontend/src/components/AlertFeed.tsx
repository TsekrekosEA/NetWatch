import { useState, useRef, useEffect, useCallback } from "react";
import type { Alert } from "../hooks/useAlertStream";
import { SeverityBadge } from "./SeverityBadge";

interface AlertFeedProps {
  alerts: Alert[];
  onAlertSelect?: (alert: Alert) => void;
}

export function AlertFeed({ alerts, onAlertSelect }: AlertFeedProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(alerts.length);
  const prevLenRef = useRef(alerts.length);

  // Track how many alerts are new for slide-in animation
  const newAlertCount = alerts.length - prevCountRef.current;

  useEffect(() => {
    prevCountRef.current = alerts.length;
  }, [alerts.length]);

  // Track unseen alerts when auto-scroll is off
  useEffect(() => {
    const diff = alerts.length - prevLenRef.current;
    prevLenRef.current = alerts.length;
    if (!autoScroll && diff > 0) {
      setUnseenCount((prev) => prev + diff);
    }
  }, [alerts.length, autoScroll]);

  // Reset unseen count when auto-scroll re-engages
  useEffect(() => {
    if (autoScroll) setUnseenCount(0);
  }, [autoScroll]);

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

  const scrollToTop = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    setAutoScroll(true);
    setUnseenCount(0);
  };

  return (
    <>
      {unseenCount > 0 && (
        <button
          onClick={scrollToTop}
          className="animate-banner-slide w-full border-b border-blue-800/50 bg-blue-900/30 px-4 py-1.5 text-center text-xs font-medium text-blue-300 transition-colors hover:bg-blue-900/50"
        >
          {unseenCount} new alert{unseenCount !== 1 ? "s" : ""} — click to
          scroll up
        </button>
      )}
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

        {alerts.map((alert, index) => {
          const expanded = expandedId === alert.id;
          const ts = new Date(alert.timestamp * 1000);
          const timeStr = ts.toLocaleTimeString();

          return (
            <div
              key={alert.id}
              className={`border-b border-gray-800/50 px-4 py-2 transition-colors hover:bg-surface-hover cursor-pointer ${
                index < newAlertCount ? "animate-slide-in" : ""
              }`}
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
                <div className="animate-expand overflow-hidden">
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
                    {onAlertSelect && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAlertSelect(alert);
                        }}
                        className="mt-2 rounded border border-blue-800/50 bg-blue-900/20 px-3 py-1 text-[11px] font-medium text-blue-300 transition-colors hover:bg-blue-900/40"
                      >
                        View Full Details
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
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
