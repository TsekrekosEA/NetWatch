import { useEffect, useState } from 'react';
import { client } from '../api/client';
import { countryCodeToFlag } from '../utils/geo';

type TopSrc = { ip: string; count: number };
type IpIntel = { country_code?: string; country?: string; city?: string; [key: string]: any };

export default function Threats() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [ipIntel, setIpIntel] = useState<Record<string, IpIntel>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await client.get('/stats/summary');
        if (cancelled) return;
        setSummary(res.data);
        
        // Fetch intel for top IPs
        const top = res.data?.top_src_ips ?? [];
        const intelMap: Record<string, IpIntel> = {};
        for (const src of top.slice(0, 5)) {
          try {
            const intelRes = await client.get(`/threats/intel/${src.ip}`);
            intelMap[src.ip] = intelRes.data;
          } catch {
            intelMap[src.ip] = {};
          }
        }
        if (!cancelled) setIpIntel(intelMap);
      } catch (err) {
        console.error('Failed to load summary', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function viewAlertsForIp(ip: string) {
    sessionStorage.setItem('alert_filter_src_ip', ip);
    window.dispatchEvent(new CustomEvent('navigate-to', { detail: { path: '/alerts' } }));
  }

  const top = summary?.top_src_ips ?? [];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Threat Map</h2>
      
      <div className="card">
        {loading && <div className="p-4 text-slate-400">Loading...</div>}
        {!loading && (
          <div>
            <div className="mb-4 text-slate-400 text-sm">Top source IPs in the last hour by country</div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* World grid visualization */}
              <div className="border border-dark-border bg-dark-surface_2 p-3 rounded-none">
                <div className="text-xs font-semibold text-slate-300 mb-2">Geographic Distribution</div>
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  {top.slice(0, 10).map((s: TopSrc) => {
                    const intel = ipIntel[s.ip] || {};
                    const flag = countryCodeToFlag(intel.country_code);
                    return (
                      <div key={s.ip} className="border border-dark-border bg-dark-surface p-1 text-center cursor-pointer hover:bg-dark-border" onClick={() => viewAlertsForIp(s.ip)}>
                        <div className="text-lg">{flag || '🌍'}</div>
                        <div className="text-slate-400 truncate">{intel.country_code || '?'}</div>
                        <div className="text-threat-high font-bold">{s.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* IP Table with flags */}
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead><tr className="text-left text-slate-400 border-b border-dark-border"><th className="px-2 py-2">IP</th><th className="px-2 py-2">Location</th><th className="px-2 py-2">Hits</th><th className="px-2 py-2">Action</th></tr></thead>
                  <tbody>
                    {top.length === 0 && <tr><td colSpan={4} className="px-2 py-4 text-slate-500">No top sources yet.</td></tr>}
                    {top.map((s: TopSrc) => {
                      const intel = ipIntel[s.ip] || {};
                      const flag = countryCodeToFlag(intel.country_code);
                      return (
                        <tr key={s.ip} className="border-t border-dark-border hover:bg-dark-surface_2">
                          <td className="px-2 py-2 font-mono text-xs">{s.ip}</td>
                          <td className="px-2 py-2 text-xs">
                            <span className="text-lg mr-1">{flag}</span>
                            <span className="text-slate-300">{intel.country || intel.country_code || '—'}</span>
                            {intel.city && <span className="text-slate-500"> / {intel.city}</span>}
                          </td>
                          <td className="px-2 py-2 text-xs text-threat-high font-bold">{s.count}</td>
                          <td className="px-2 py-2 text-xs"><button className="px-2 py-1 border border-dark-border" onClick={() => viewAlertsForIp(s.ip)}>View</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
