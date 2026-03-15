import { useEffect, useMemo } from "react";
import type { Alert } from "../hooks/useAlertStream";
import { SeverityBadge } from "./SeverityBadge";

interface AlertDetailModalProps {
  alert: Alert;
  allAlerts: Alert[];
  onClose: () => void;
}

export function AlertDetailModal({
  alert,
  allAlerts,
  onClose,
}: AlertDetailModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Related alerts from the same source IP (excluding current)
  const relatedAlerts = useMemo(
    () =>
      allAlerts
        .filter((a) => a.id !== alert.id && a.src_ip === alert.src_ip)
        .slice(0, 20),
    [allAlerts, alert.id, alert.src_ip],
  );

  // Alerts targeting the same destination
  const destAlerts = useMemo(
    () =>
      allAlerts
        .filter(
          (a) =>
            a.id !== alert.id &&
            a.dst_ip === alert.dst_ip &&
            a.dst_port === alert.dst_port,
        )
        .slice(0, 10),
    [allAlerts, alert.id, alert.dst_ip, alert.dst_port],
  );

  const ts = new Date(alert.timestamp * 1000);
  const details = alert.details as Record<string, unknown> | null;
  const statDetails = details?.statistical as Record<string, unknown> | undefined;
  const mlDetails = details?.ml as Record<string, unknown> | undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-fade-in mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-gray-700 bg-surface-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <SeverityBadge severity={alert.severity} />
            <h2 className="text-lg font-semibold text-white">
              {alert.category}
            </h2>
            <span className="rounded bg-gray-700/50 px-2 py-0.5 text-[10px] text-gray-400">
              #{alert.id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-700 hover:text-gray-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          {/* Flow metadata */}
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Flow Details
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded bg-surface p-3 text-sm">
              <Row label="Timestamp" value={ts.toLocaleString()} />
              <Row label="Stage" value={alert.stage} />
              <Row
                label="Source"
                value={`${alert.src_ip}:${alert.src_port ?? "—"}`}
                mono
              />
              <Row
                label="Destination"
                value={`${alert.dst_ip}:${alert.dst_port ?? "—"}`}
                mono
              />
              <Row label="Protocol" value={alert.protocol} />
              <Row
                label="Duration"
                value={
                  alert.flow_duration != null
                    ? `${alert.flow_duration.toFixed(3)}s`
                    : "—"
                }
              />
              <Row
                label="Total Bytes"
                value={alert.total_bytes?.toLocaleString() ?? "—"}
              />
              <Row
                label="Total Packets"
                value={alert.total_packets?.toLocaleString() ?? "—"}
              />
            </div>
          </section>

          {/* Statistical details */}
          {statDetails && (
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Statistical Analysis
              </h3>
              <div className="rounded bg-surface p-3">
                <div className="mb-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <Row
                    label="Category"
                    value={String(statDetails.stat_category ?? "—")}
                  />
                  <Row
                    label="Severity"
                    value={String(statDetails.stat_severity ?? "—")}
                  />
                </div>
                {Array.isArray(statDetails.anomalous_features) && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs text-gray-500">
                      Anomalous Features (z-score):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(
                        statDetails.anomalous_features as [string, number][]
                      ).map(([name, z]) => (
                        <span
                          key={name}
                          className="rounded bg-amber-900/30 px-2 py-0.5 text-[11px] text-amber-300"
                        >
                          {name}: {z.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ML details */}
          {mlDetails && (
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                ML Classification
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded bg-surface p-3 text-sm">
                <Row
                  label="RF Class"
                  value={String(mlDetails.rf_class ?? "—")}
                />
                <Row
                  label="RF Confidence"
                  value={
                    mlDetails.rf_confidence != null
                      ? `${(Number(mlDetails.rf_confidence) * 100).toFixed(1)}%`
                      : "—"
                  }
                />
                <Row
                  label="IF Score"
                  value={
                    mlDetails.if_score != null
                      ? Number(mlDetails.if_score).toFixed(4)
                      : "—"
                  }
                />
                <Row
                  label="ML Category"
                  value={String(mlDetails.ml_category ?? "—")}
                />
              </div>
            </section>
          )}

          {/* Related alerts from same source IP */}
          {relatedAlerts.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Related Alerts from {alert.src_ip} ({relatedAlerts.length})
              </h3>
              <div className="max-h-40 overflow-y-auto rounded bg-surface">
                {relatedAlerts.map((ra) => (
                  <div
                    key={ra.id}
                    className="flex items-center gap-2 border-b border-gray-800/50 px-3 py-1.5 text-xs"
                  >
                    <span className="w-16 text-gray-500">
                      {new Date(ra.timestamp * 1000).toLocaleTimeString()}
                    </span>
                    <SeverityBadge severity={ra.severity} />
                    <span className="text-gray-300">{ra.category}</span>
                    <span className="ml-auto font-mono text-gray-500">
                      → {ra.dst_ip}:{ra.dst_port ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Alerts targeting same destination */}
          {destAlerts.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Other Alerts to {alert.dst_ip}:{alert.dst_port ?? "—"} (
                {destAlerts.length})
              </h3>
              <div className="max-h-32 overflow-y-auto rounded bg-surface">
                {destAlerts.map((da) => (
                  <div
                    key={da.id}
                    className="flex items-center gap-2 border-b border-gray-800/50 px-3 py-1.5 text-xs"
                  >
                    <span className="w-16 text-gray-500">
                      {new Date(da.timestamp * 1000).toLocaleTimeString()}
                    </span>
                    <SeverityBadge severity={da.severity} />
                    <span className="font-mono text-gray-400">
                      {da.src_ip}
                    </span>
                    <span className="ml-auto text-gray-300">{da.category}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Raw details JSON */}
          {details && (
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Raw Details
              </h3>
              <pre className="max-h-48 overflow-auto rounded bg-gray-900 p-3 text-[10px] leading-relaxed text-gray-400">
                {JSON.stringify(details, null, 2)}
              </pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`text-gray-300 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
