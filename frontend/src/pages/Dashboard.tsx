import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock3,
  Cpu,
  Database,
  Radar,
  Search,
  Siren,
  Signal,
  TriangleAlert,
  Waves,
} from "lucide-react";
import {
} from "recharts";
import type { Alert } from "../hooks/useAlertStream";
import type { HealthStatus, StatsSummary } from "../hooks/useStats";

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityColor(severity: string) {
  switch (severity) {
    case "CRITICAL": return "text-threat-critical border-threat-critical bg-threat-critical/10";
    case "HIGH": return "text-threat-high border-threat-high bg-threat-high/10";
    case "MEDIUM": return "text-threat-medium border-threat-medium bg-threat-medium/10";
    case "LOW": return "text-threat-low border-threat-low bg-threat-low/10";
    default: return "text-threat-info border-threat-info bg-threat-info/10";
  }
}

function severityBarColor(severity: string) {
  switch (severity) {
    case "CRITICAL": return "bg-threat-critical";
    case "HIGH": return "bg-threat-high";
    case "MEDIUM": return "bg-threat-medium";
    case "LOW": return "bg-threat-low";
    default: return "bg-threat-info";
  }
}

function boxClass(extra = "") { return `border border-dark-border bg-dark-surface ${extra}`; }
function textToneForSeverity(severity: string) {
  switch (severity) {
    case "CRITICAL": return "text-threat-critical";
    case "HIGH": return "text-threat-high";
    case "MEDIUM": return "text-threat-medium";
    case "LOW": return "text-threat-low";
    default: return "text-threat-info";
  }
}

function MetricCard({ label, value, detail, icon, tone }: { label: string; value: string | number; detail: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className={boxClass("p-3 transition-colors hover:bg-dark-surface_2")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{label}</div>
          <div className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</div>
          <div className="mt-1 text-xs text-slate-400">{detail}</div>
        </div>
        <div className={`border ${tone} bg-dark-surface_2 p-2`}>{icon}</div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={boxClass("p-0 overflow-hidden")}>
      <div className="flex items-center justify-between border-b border-dark-border px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="border border-dark-border bg-dark-surface_2 p-2">{icon}</div>
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

type DashboardProps = {
  alerts: Alert[];
  liveStats: { flows_last_minute: number; alerts_last_minute: number };
  connected: boolean;
  summary: StatsSummary;
  health: HealthStatus | null;
  loading: boolean;
};

export function Dashboard({ alerts, liveStats, connected, summary, health, loading }: DashboardProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [alertSearch, setAlertSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (severityFilter && a.severity !== severityFilter) return false;
      if (alertSearch) {
        const search = alertSearch.toLowerCase();
        return a.src_ip.includes(search) || a.dst_ip.includes(search) || a.category.toLowerCase().includes(search) || a.protocol.toLowerCase().includes(search);
      }
      return true;
    }).slice(0, 10);
  }, [alerts, alertSearch, severityFilter]);

  const criticalCount = summary.alerts_by_severity.CRITICAL ?? 0;
  const totalAlerts = summary.total_alerts_1h ?? 0;
  const totalFlows = summary.total_flows_1h ?? 0;
  const highCount = summary.alerts_by_severity.HIGH ?? 0;
  const mediumCount = summary.alerts_by_severity.MEDIUM ?? 0;
  const lowCount = summary.alerts_by_severity.LOW ?? 0;

  const sourceMatrix = useMemo(() => {
    const map = new Map<string, { ip: string; count: number; critical: number; lastSeen: number; categories: Record<string, number> }>();
    alerts.forEach((alert) => {
      const current = map.get(alert.src_ip) ?? { ip: alert.src_ip, count: 0, critical: 0, lastSeen: alert.timestamp, categories: {} };
      current.count += 1;
      current.lastSeen = Math.max(current.lastSeen, alert.timestamp);
      current.categories[alert.category] = (current.categories[alert.category] ?? 0) + 1;
      if (alert.severity === "CRITICAL") current.critical += 1;
      map.set(alert.src_ip, current);
    });
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [alerts]);

  const severityRows = [
    { label: "Critical", value: criticalCount, tone: "bg-threat-critical" },
    { label: "High", value: highCount, tone: "bg-threat-high" },
    { label: "Medium", value: mediumCount, tone: "bg-threat-medium" },
    { label: "Low", value: lowCount, tone: "bg-threat-low" },
  ];

  const pipelineLoaded = health?.ml_loaded ? "Loaded" : "Offline";
  const uptime = health?.uptime_seconds ? `${Math.floor(health.uptime_seconds / 3600)}h ${Math.floor((health.uptime_seconds % 3600) / 60)}m` : "0m";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <div className="border border-dark-border bg-dark-surface px-3 py-2 text-slate-400">
          <span className={`mr-2 inline-block h-2 w-2 ${connected ? "bg-threat-low" : "bg-threat-high"}`} />
          {connected ? "Streaming" : "Disconnected"}
        </div>
        <div className="border border-dark-border bg-dark-surface px-3 py-2 text-slate-400">
          {loading ? "Refreshing" : `Updated ${formatTime(Date.now() / 1000)}`}
        </div>
        <div className="border border-dark-border bg-dark-surface px-3 py-2 text-slate-400">
          {health?.status ?? "unknown"}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Critical Alerts" value={criticalCount} detail="Stage 2 escalations in the last hour" icon={<Siren className="h-5 w-5 text-threat-critical" />} tone="text-threat-critical" />
        <MetricCard label="Traffic Volume" value={totalFlows.toLocaleString()} detail="Flows processed in the last hour" icon={<Waves className="h-5 w-5 text-blue-300" />} tone="text-blue-300" />
        <MetricCard label="Alert Pressure" value={totalAlerts.toLocaleString()} detail={`Live stream: ${liveStats.alerts_last_minute} alerts/min`} icon={<TriangleAlert className="h-5 w-5 text-threat-high" />} tone="text-threat-high" />
        <MetricCard label="Pipeline State" value={pipelineLoaded} detail={`${health?.flows_processed?.toLocaleString() ?? "0"} flows processed · uptime ${uptime}`} icon={<Cpu className="h-5 w-5 text-threat-low" />} tone="text-threat-low" />
      </div>

      <div className={boxClass("grid grid-cols-1 gap-2 border-threat-high/30 p-2 xl:grid-cols-4")}>
        <div className="border border-dark-border bg-dark-surface p-2"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Top source</div><div className="mt-1 font-mono text-lg text-white">{sourceMatrix[0]?.ip ?? "—"}</div></div>
        <div className="border border-dark-border bg-dark-surface p-2"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Top category</div><div className="mt-1 text-lg text-threat-high">{sourceMatrix[0] ? Object.entries(sourceMatrix[0].categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—" : "—"}</div></div>
        <div className="border border-dark-border bg-dark-surface p-2"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Traffic / min</div><div className="mt-1 text-lg text-blue-300">{liveStats.flows_last_minute}</div></div>
        <div className="border border-dark-border bg-dark-surface p-2"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Alert / min</div><div className="mt-1 text-lg text-threat-critical">{liveStats.alerts_last_minute}</div></div>
      </div>

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
        <div className="border border-dark-border bg-dark-surface p-3"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Incident posture</div><div className="mt-1 space-y-2">{severityRows.map((row) => (<div key={row.label}><div className="mb-1 flex items-center justify-between text-xs text-slate-400"><span>{row.label}</span><span className={textToneForSeverity(row.label.toUpperCase())}>{row.value}</span></div><div className="h-2 border border-dark-border bg-dark-surface"><div className={row.tone} style={{ width: `${Math.min(row.value * 8, 100)}%`, height: "100%" }} /></div></div>))}</div></div>
        <div className="border border-dark-border bg-dark-surface p-3"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Dominant protocol</div><div className="mt-2 text-2xl font-semibold text-white">{Object.entries(summary.protocol_distribution).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"}</div><div className="mt-1 text-xs text-slate-500">Highest share in current capture window</div></div>
        <div className="border border-dark-border bg-dark-surface p-3"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Pipeline pressure</div><div className="mt-2 text-2xl font-semibold text-threat-low">{health?.ml_loaded ? "Nominal" : "Degraded"}</div><div className="mt-1 text-xs text-slate-500">Model loaded: {health?.ml_loaded ? "yes" : "no"} · flows: {health?.flows_processed?.toLocaleString() ?? "0"}</div></div>
      </div>

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Panel title="Live Incident Stream" subtitle="Newest events first, expanded inline when needed" icon={<Radar className="h-5 w-5 text-blue-300" />}>
            <div className="space-y-2 border-b border-dark-border pb-2 mb-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-500" />
                <input type="text" placeholder="Search IP, category, protocol..." value={alertSearch} onChange={(e) => setAlertSearch(e.target.value)} className="flex-1 bg-dark-surface_2 border border-dark-border px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none" />
              </div>
              <div className="flex flex-wrap gap-1 text-xs">
                {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (<button key={sev} onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)} className={`border px-2 py-1 transition-colors ${severityFilter === sev ? "bg-opacity-20 border-opacity-100" : "border-dark-border text-slate-400"}`}>{sev}</button>))}
              </div>
            </div>
            <div className="divide-y divide-dark-border border border-dark-border bg-dark-surface">
              {filteredAlerts.length === 0 && (<div className="p-4 text-sm text-slate-500">Waiting for alerts{alertSearch || severityFilter ? " matching filters" : ""}...</div>)}
              {filteredAlerts.map((alert) => {
                const expanded = expandedId === alert.id;
                return (
                  <div key={alert.id} className="bg-dark-surface">
                    <button className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-dark-surface_2" onClick={() => setExpandedId(expanded ? null : alert.id)}>
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <span className={`border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] ${severityColor(alert.severity)} ${severityBarColor(alert.severity)}`}>{alert.severity}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-xs text-slate-200">{alert.src_ip}:{alert.src_port ?? "—"}<ArrowRight className="mx-1 inline-block h-3 w-3 text-slate-600" />{alert.dst_ip}:{alert.dst_port ?? "—"}</div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span>{alert.category}</span><span>{alert.protocol}</span><span>{alert.stage}</span></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-3 w-3" />{formatTime(alert.timestamp)}{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</div>
                    </button>
                    {expanded && (
                      <div className="border-t border-dark-border px-3 py-2 text-xs text-slate-400">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <div className="border border-dark-border bg-dark-surface p-2"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Flow</div><div className="mt-1 font-mono text-slate-200">{alert.src_ip}:{alert.src_port ?? "—"} to {alert.dst_ip}:{alert.dst_port ?? "—"}</div></div>
                          <div className="border border-dark-border bg-dark-surface p-2"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Bytes / Packets</div><div className="mt-1 font-mono text-slate-200">{alert.total_bytes?.toLocaleString() ?? "—"} bytes / {alert.total_packets?.toLocaleString() ?? "—"} packets</div></div>
                          <div className="border border-dark-border bg-dark-surface p-2"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Duration</div><div className="mt-1 font-mono text-slate-200">{alert.flow_duration != null ? `${alert.flow_duration.toFixed(3)}s` : "—"}</div></div>
                          <div className="border border-dark-border bg-dark-surface p-2"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Details</div><div className="mt-1 font-mono text-slate-200">{alert.details ? "structured payload present" : "no extra payload"}</div></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
        <div className="xl:col-span-5 space-y-2">
          <Panel title="Attack Source Matrix" subtitle="Top source IPs ranked by alert volume and criticality" icon={<Signal className="h-5 w-5 text-threat-high" />}>
            <div className="border border-dark-border bg-dark-bg"><div className="grid grid-cols-12 border-b border-dark-border px-2 py-2 text-[10px] uppercase tracking-[0.25em] text-slate-500"><div className="col-span-5">Source IP</div><div className="col-span-2 text-center">Hits</div><div className="col-span-3">Top Category</div><div className="col-span-2 text-right">Last Seen</div></div>{sourceMatrix.length === 0 ? (<div className="px-3 py-4 text-sm text-slate-500">No attack sources yet.</div>) : (sourceMatrix.map((row) => {const dominantCategory = Object.entries(row.categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";return (<div key={row.ip} className="grid grid-cols-12 items-center border-b border-dark-border px-2 py-2 text-sm last:border-b-0"><div className="col-span-5 font-mono text-slate-200 text-xs">{row.ip}</div><div className="col-span-2 text-center text-threat-high">{row.count}</div><div className="col-span-3 truncate text-slate-300 text-xs">{dominantCategory}</div><div className="col-span-2 text-right text-xs text-slate-500">{formatTime(row.lastSeen)}</div></div>);}))}</div>
          </Panel>
          <Panel title="Pipeline Telemetry" subtitle="Model readiness, capacity, and severity pressure" icon={<Database className="h-5 w-5 text-threat-low" />}>
            <div className="space-y-2"><div className="grid grid-cols-2 gap-2"><div className="border border-dark-border bg-dark-surface p-2"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Model</div><div className="mt-1 text-lg font-semibold text-white">{pipelineLoaded}</div></div><div className="border border-dark-border bg-dark-surface p-2"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Uptime</div><div className="mt-1 text-lg font-semibold text-white">{uptime}</div></div></div></div>
          </Panel>
        </div>
      </div>
    </motion.div>
  );
}
