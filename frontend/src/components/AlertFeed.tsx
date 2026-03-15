import { useState, useRef, useEffect, useCallback } from "react";
import type { Alert } from "../hooks/useAlertStream";
import { SeverityBadge } from "./SeverityBadge";
import { client } from "../api/client";

interface AlertFeedProps {
  alerts: Alert[];
  onAlertSelect?: (alert: Alert) => void;
}

// Module-level cache persists across re-renders without causing them.
// Maps ip → ISO-3166-1 alpha-2 country code (empty string = private/unknown).
const ipCountryCache = new Map<string, string>();
const ipPending = new Set<string>();

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("");
}

export function AlertFeed({ alerts, onAlertSelect }: AlertFeedProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  // Bump to force re-render when flag cache entries arrive.
  const [flagVersion, setFlagVersion] = useState(0);
  void flagVersion;
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(alerts.length);

  // Fetch country codes for any newly-seen source IPs.
  useEffect(() => {
    const unique = [...new Set(alerts.map((a) => a.src_ip))];
    const fresh = unique.filter(
      (ip) => !ipCountryCache.has(ip) && !ipPending.has(ip),
    );
    if (fresh.length === 0) return;
    fresh.forEach((ip) => {
      ipPending.add(ip);
      client
        .get<{ country_code?: string; private?: boolean }>(
          `/threats/intel/${ip}`,
        )
        .then((r) => {
          ipCountryCache.set(ip, r.data.country_code ?? "");
          setFlagVersion((v) => v + 1);
        })
        .catch(() => ipCountryCache.set(ip, ""))
        .finally(() => ipPending.delete(ip));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  // Track unseen alerts when scrolled away from top.
  useEffect(() => {
    const diff = alerts.length - prevLenRef.current;
    prevLenRef.current = alerts.length;
    if (!autoScroll && diff > 0) {
      setUnseenCount((prev) => prev + diff);
    }
  }, [alerts.length, autoScroll]);

  useEffect(() => {
    if (autoScroll) setUnseenCount(0);
  }, [autoScroll]);

  // Disable auto-scroll while an item is expanded so new alerts don't
  // pull the view away from the expanded row.
  useEffect(() => {
    if (expandedId !== null) setAutoScroll(false);
  }, [expandedId]);

  // Auto-scroll to top only when nothing is expanded.
  useEffect(() => {
    if (autoScroll && expandedId === null && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [alerts.length, autoScroll, expandedId]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    // Re-engage auto-scroll only when user scrolls back to the very top.
    if (el.scrollTop < 10) setAutoScroll(true);
  }, []);

  const scrollToTop = () => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
    setAutoScroll(true);
    setUnseenCount(0);
    setExpandedId(null);
  };

  // Scroll the newly-expanded row into view.
  const expandedRowRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

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

        {alerts.map((alert) => {
          const expanded = expandedId === alert.id;
          const ts = new Date(alert.timestamp * 1000);
          const flag = countryFlag(ipCountryCache.get(alert.src_ip) ?? "");

          return (
            <div
              key={alert.id}
              className="animate-slide-in border-b border-gray-800/50 px-4 py-2 transition-colors hover:bg-surface-hover cursor-pointer"
              onClick={() => setExpandedId(expanded ? null : alert.id)}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="w-20 shrink-0 text-xs text-gray-500">
                  {ts.toLocaleTimeString()}
                </span>
                <SeverityBadge severity={alert.severity} />
                <span className="font-mono text-xs text-gray-300">
                  {flag && (
                    <span
                      className="mr-0.5"
                      title={`Country: ${ipCountryCache.get(alert.src_ip)}`}
                    >
                      {flag}
                    </span>
                  )}
                  {alert.src_ip}:{alert.src_port ?? "—"}
                  <span className="mx-1 text-gray-600">→</span>
                  {alert.dst_ip}:{alert.dst_port ?? "—"}
                </span>
                <span className="ml-auto shrink-0 text-xs text-gray-400">
                  {alert.category}
                </span>
                <span
                  className={`shrink-0 rounded px-1 text-[10px] ${
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
                <div
                  ref={expandedRowRef}
                  className="animate-expand overflow-hidden"
                >
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
