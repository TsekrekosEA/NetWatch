import React, { useEffect, useState } from 'react';
import { client } from '../api/client';
import { countryCodeToFlag } from '../utils/geo';

type Alert = any;
type IpIntel = { country_code?: string; country?: string; [key: string]: any };

const SETTINGS_KEY = 'netwatch.settings';

function getAlertPageSize() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return 20;
    const parsed = JSON.parse(raw);
    return Math.max(5, Number(parsed.alertPageSize) || 20);
  } catch {
    return 20;
  }
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(getAlertPageSize());
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exported, setExported] = useState(false);
  const [ipIntel, setIpIntel] = useState<Record<string, IpIntel>>({});

  const [severity, setSeverity] = useState<string | null>(null);
  const [srcIp, setSrcIp] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function handleExport() {
    try {
      const params = new URLSearchParams();
      if (severity) params.append('severity', severity);
      if (srcIp) params.append('src_ip', srcIp);
      if (category) params.append('category', category);
      const url = `http://localhost:8001/alerts/export?${params.toString()}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `alerts_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setExported(true);
      setTimeout(() => setExported(false), 2000);
    } catch (err) {
      console.error('Export failed', err);
    }
  }

  useEffect(() => {
    const prefilter = sessionStorage.getItem('alert_filter_src_ip');
    if (prefilter) {
      setSrcIp(prefilter);
      sessionStorage.removeItem('alert_filter_src_ip');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await client.get('/alerts', {
          params: {
            limit,
            offset,
            severity: severity ?? undefined,
            src_ip: srcIp ?? undefined,
            category: category ?? undefined,
          },
        });
        if (cancelled) return;
        setAlerts(res.data.alerts || []);
        setTotal(res.data.total ?? 0);

        // Fetch intel for unique IPs
        const intelMap: Record<string, IpIntel> = {};
        const uniqueIps = new Set((res.data.alerts || []).map((a: Alert) => a.src_ip));
        for (const ip of uniqueIps) {
          try {
            const intelRes = await client.get(`/threats/intel/${ip}`);
            intelMap[ip as string] = intelRes.data;
          } catch {
            intelMap[ip as string] = {};
          }
        }
        if (!cancelled) setIpIntel(intelMap);
      } catch (err) {
        console.error('Failed to load alerts', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [limit, offset, severity, srcIp, category]);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Alerts</h2>

      <div className="mb-3 flex gap-2">
        <input placeholder="Src IP" value={srcIp ?? ''} onChange={(e) => setSrcIp(e.target.value || null)} className="bg-dark-surface_2 border border-dark-border px-2 py-1 text-sm" />
        <input placeholder="Category" value={category ?? ''} onChange={(e) => setCategory(e.target.value || null)} className="bg-dark-surface_2 border border-dark-border px-2 py-1 text-sm" />
        <select value={severity ?? ''} onChange={(e) => setSeverity(e.target.value || '' ? e.target.value : null)} className="bg-dark-surface_2 border border-dark-border px-2 py-1 text-sm">
          <option value="">All severities</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
        <button className="px-3 py-1 bg-dark-surface_2 border border-dark-border" onClick={() => { setLimit(getAlertPageSize()); setOffset(0); }}>Apply</button>
        <button className="px-3 py-1 bg-dark-surface_2 border border-dark-border ml-auto" onClick={handleExport}>Export CSV</button>
      </div>
      {exported && <div className="mb-2 text-xs text-threat-low">✓ Export started</div>}

      <div className="card">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Location</th>
                <th className="px-2 py-2">Dest</th>
                <th className="px-2 py-2">Proto</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Severity</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (<tr><td colSpan={9} className="px-2 py-4 text-slate-500">Loading...</td></tr>)}
              {!loading && alerts.length === 0 && (<tr><td colSpan={9} className="px-2 py-4 text-slate-500">No alerts found.</td></tr>)}
              {alerts.map((a: Alert) => {
                const intel = (ipIntel[a.src_ip] as IpIntel) || {};
                const flag = countryCodeToFlag((intel.country_code as string) || '');
                return (
                  <React.Fragment key={a.id}>
                    <tr className="border-t border-dark-border hover:bg-dark-surface_2">
                      <td className="px-2 py-2 font-mono text-xs">{a.id}</td>
                      <td className="px-2 py-2 text-xs">{new Date(a.timestamp * 1000).toLocaleString()}</td>
                      <td className="px-2 py-2 text-xs font-mono">
                        <span className="text-lg mr-1">{flag}</span>
                        {a.src_ip}:{a.src_port ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-400">
                        {intel.country_code} {intel.city && `/ ${intel.city}`}
                      </td>
                      <td className="px-2 py-2 text-xs font-mono">{a.dst_ip}:{a.dst_port ?? '—'}</td>
                      <td className="px-2 py-2 text-xs">{a.protocol}</td>
                      <td className="px-2 py-2 text-xs">{a.category}</td>
                      <td className="px-2 py-2 text-xs">{a.severity}</td>
                      <td className="px-2 py-2 text-xs">
                        <button className="px-2 py-1 border border-dark-border" onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}>Details</button>
                      </td>
                    </tr>
                    {expandedId === a.id && (
                      <tr className="bg-dark-surface border-t border-dark-border"><td colSpan={9} className="px-3 py-2 text-xs text-slate-300">
                        <div className="grid grid-cols-2 gap-2">
                          <div>Flow duration: {a.flow_duration ?? '—'}</div>
                          <div>Bytes / Packets: {a.total_bytes ?? '—'} / {a.total_packets ?? '—'}</div>
                          <div>Stage: {a.stage}</div>
                          <div>Details: {a.details ? 'has payload' : '—'}</div>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-3 border-t border-dark-border">
          <div className="text-sm text-slate-400">Total: {total}</div>
          <div className="flex items-center gap-2">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="px-3 py-1 border border-dark-border bg-dark-surface_2 disabled:opacity-50">Prev</button>
            <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className="px-3 py-1 border border-dark-border bg-dark-surface_2 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
