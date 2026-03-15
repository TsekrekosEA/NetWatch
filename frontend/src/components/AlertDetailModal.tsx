import { useEffect, useMemo, useState } from "react";
import type { Alert } from "../hooks/useAlertStream";
import { SeverityBadge } from "./SeverityBadge";
import { client } from "../api/client";

interface IpIntel {
  private?: boolean;
  ip?: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  isp?: string;
  org?: string;
  asn?: string;
  abuse_score?: number;
  abuse_reports?: number;
  is_tor?: boolean;
}

function countryFlag(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("");
}

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

  // Fetch IP threat intel for source IP
  const [intel, setIntel] = useState<IpIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);
  useEffect(() => {
    setIntel(null);
    setIntelLoading(true);
    client
      .get<IpIntel>(`/threats/intel/${alert.src_ip}`)
      .then((r) => setIntel(r.data))
      .catch(() => setIntel(null))
      .finally(() => setIntelLoading(false));
  }, [alert.src_ip]);

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

          {/* IP Threat Intelligence */}
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Threat Intelligence — {alert.src_ip}
            </h3>
            {intelLoading ? (
              <div className="flex items-center gap-2 rounded bg-surface p-3 text-xs text-gray-500">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Looking up intel…
              </div>
            ) : intel?.private ? (
              <div className="rounded bg-surface p-3 text-xs text-gray-500">
                Private / RFC-1918 address — no external intel available.
              </div>
            ) : intel && Object.keys(intel).length > 1 ? (
              <div className="rounded bg-surface p-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  {intel.country && (
                    <Row
                      label="Location"
                      value={`${intel.country_code ? countryFlag(intel.country_code) + " " : ""}${intel.city ? intel.city + ", " : ""}${intel.country}`}
                    />
                  )}
                  {intel.region && <Row label="Region" value={intel.region} />}
                  {intel.isp && <Row label="ISP" value={intel.isp} />}
                  {intel.org && intel.org !== intel.isp && (
                    <Row label="Org" value={intel.org} />
                  )}
                  {intel.asn && <Row label="ASN" value={intel.asn} mono />}
                </div>
                {(intel.abuse_score !== undefined || intel.is_tor) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-gray-800 pt-2">
                    {intel.abuse_score !== undefined && (
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                          intel.abuse_score >= 50
                            ? "bg-red-900/40 text-red-300"
                            : intel.abuse_score >= 10
                              ? "bg-amber-900/40 text-amber-300"
                              : "bg-green-900/30 text-green-400"
                        }`}
                      >
                        Abuse score: {intel.abuse_score}%
                      </span>
                    )}
                    {intel.abuse_reports !== undefined && (
                      <span className="rounded bg-gray-700/50 px-2 py-0.5 text-[11px] text-gray-400">
                        {intel.abuse_reports} reports
                      </span>
                    )}
                    {intel.is_tor && (
                      <span className="rounded bg-purple-900/40 px-2 py-0.5 text-[11px] font-medium text-purple-300">
                        Tor exit node
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded bg-surface p-3 text-xs text-gray-500">
                No intel available for this IP.
              </div>
            )}
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
