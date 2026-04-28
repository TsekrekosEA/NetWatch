import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStats } from '../hooks/useStats';

const SETTINGS_KEY = 'netwatch.settings';

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { analyticsMinutes: 10, autoRefreshSeconds: 15 };
    const parsed = JSON.parse(raw);
    return {
      analyticsMinutes: Math.max(5, Number(parsed.analyticsMinutes) || 10),
      autoRefreshSeconds: Math.max(5, Number(parsed.autoRefreshSeconds) || 15),
    };
  } catch {
    return { analyticsMinutes: 10, autoRefreshSeconds: 15 };
  }
}

function toSeriesLabel(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Analytics() {
  const settings = readSettings();
  const { summary, timeline, loading } = useStats(settings.autoRefreshSeconds * 1000, settings.analyticsMinutes);

  const severityData = useMemo(() => [
    { name: 'CRITICAL', value: summary.alerts_by_severity.CRITICAL ?? 0 },
    { name: 'HIGH', value: summary.alerts_by_severity.HIGH ?? 0 },
    { name: 'MEDIUM', value: summary.alerts_by_severity.MEDIUM ?? 0 },
    { name: 'LOW', value: summary.alerts_by_severity.LOW ?? 0 },
  ], [summary]);

  const categoryData = useMemo(() => Object.entries(summary.alerts_by_category)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8), [summary]);

  const flowSeries = useMemo(() => timeline.map((bucket) => ({
    time: toSeriesLabel(bucket.ts),
    flows: bucket.flows,
    alerts: bucket.alerts,
    bytes: Math.round(bucket.bytes / 1024),
  })), [timeline]);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold mb-1">Analytics</h2>
        <p className="text-sm text-slate-400">Traffic, alerts, and severity trends from the backend summary endpoints.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="card"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Flows / 1h</div><div className="mt-2 text-3xl font-semibold text-white">{summary.total_flows_1h.toLocaleString()}</div></div>
        <div className="card"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Alerts / 1h</div><div className="mt-2 text-3xl font-semibold text-threat-high">{summary.total_alerts_1h.toLocaleString()}</div></div>
        <div className="card"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Top Sources</div><div className="mt-2 text-3xl font-semibold text-threat-low">{summary.top_src_ips.length}</div></div>
        <div className="card"><div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Timeline Points</div><div className="mt-2 text-3xl font-semibold text-blue-300">{timeline.length}</div></div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className="card">
          <div className="mb-3 text-sm font-semibold text-white">Traffic & Alerts Timeline</div>
          <div className="h-72">
            {loading ? (
              <div className="flex h-full items-center justify-center text-slate-500">Loading timeline...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={flowSeries}>
                  <CartesianGrid stroke="#2a313d" strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#1f1f1f', border: '1px solid #2a313d', color: '#f3f4f6' }} />
                  <Line type="monotone" dataKey="flows" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="alerts" stroke="#ff6b35" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="card">
          <div className="mb-3 text-sm font-semibold text-white">Bytes per Minute</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowSeries}>
                <CartesianGrid stroke="#2a313d" strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#1f1f1f', border: '1px solid #2a313d', color: '#f3f4f6' }} />
                <Bar dataKey="bytes" fill="#6BCB77" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className="card">
          <div className="mb-3 text-sm font-semibold text-white">Severity Mix</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {severityData.map((item) => (
              <div key={item.name} className="border border-dark-border bg-dark-surface_2 p-3">
                <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">{item.name}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="mb-3 text-sm font-semibold text-white">Top Categories</div>
          <div className="h-72">
            {loading ? (
              <div className="flex h-full items-center justify-center text-slate-500">Loading categories...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid stroke="#2a313d" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={120} />
                  <Tooltip contentStyle={{ background: '#1f1f1f', border: '1px solid #2a313d', color: '#f3f4f6' }} />
                  <Bar dataKey="value" fill="#d946ef" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
