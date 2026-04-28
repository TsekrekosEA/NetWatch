import { useEffect, useState } from 'react';

const SETTINGS_KEY = 'netwatch.settings';

type SettingsState = {
  alertPageSize: number;
  analyticsMinutes: number;
  autoRefreshSeconds: number;
};

const DEFAULTS: SettingsState = {
  alertPageSize: 20,
  analyticsMinutes: 10,
  autoRefreshSeconds: 15,
};

export function getSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    try {
      setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      // Ignore malformed local settings.
    }
  }, []);

  function persist(next: SettingsState) {
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold mb-1">Settings</h2>
        <p className="text-sm text-slate-400">These preferences are stored locally in your browser.</p>
      </div>

      <div className="card space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="block text-slate-400">Alerts page size</span>
            <input type="number" min={5} max={100} value={settings.alertPageSize} onChange={(e) => persist({ ...settings, alertPageSize: Number(e.target.value) || DEFAULTS.alertPageSize })} className="w-full bg-dark-surface_2 border border-dark-border px-3 py-2 text-white" />
          </label>

          <label className="space-y-2 text-sm">
            <span className="block text-slate-400">Analytics window (minutes)</span>
            <input type="number" min={5} max={240} value={settings.analyticsMinutes} onChange={(e) => persist({ ...settings, analyticsMinutes: Number(e.target.value) || DEFAULTS.analyticsMinutes })} className="w-full bg-dark-surface_2 border border-dark-border px-3 py-2 text-white" />
          </label>

          <label className="space-y-2 text-sm">
            <span className="block text-slate-400">Auto refresh (seconds)</span>
            <input type="number" min={5} max={120} value={settings.autoRefreshSeconds} onChange={(e) => persist({ ...settings, autoRefreshSeconds: Number(e.target.value) || DEFAULTS.autoRefreshSeconds })} className="w-full bg-dark-surface_2 border border-dark-border px-3 py-2 text-white" />
          </label>

        </div>

        <div className="flex items-center justify-between border-t border-dark-border pt-3">
          <button
            className="px-3 py-2 border border-dark-border bg-dark-surface_2 text-white hover:bg-dark-border"
            onClick={() => persist(DEFAULTS)}
          >
            Reset to defaults
          </button>
          <span className={`text-sm ${saved ? 'text-threat-low' : 'text-slate-500'}`}>{saved ? 'Saved locally' : 'Changes save instantly'}</span>
        </div>
      </div>
    </div>
  );
}
