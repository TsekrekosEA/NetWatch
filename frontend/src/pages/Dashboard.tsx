import { useState } from "react";
import { useAlertStream } from "../hooks/useAlertStream";
import { useStats } from "../hooks/useStats";
import { StatsBar } from "../components/StatsBar";
import { AlertFeed } from "../components/AlertFeed";
import { TrafficChart } from "../components/TrafficChart";
import { ProtocolBreakdown } from "../components/ProtocolBreakdown";
import { ThreatHeatmap } from "../components/ThreatHeatmap";
import { CriticalAlertToast } from "../components/CriticalAlertToast";

type RightTab = "traffic" | "threats";

export function Dashboard() {
  const { alerts, liveStats, connected } = useAlertStream();
  const { summary, timeline, health, loading } = useStats();
  const [rightTab, setRightTab] = useState<RightTab>("traffic");

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <CriticalAlertToast alerts={alerts} />
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 bg-surface-card px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-white">
            NetWatch
          </h1>
          <span className="rounded bg-blue-900/40 px-2 py-0.5 text-xs text-blue-300">
            IDS Dashboard
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              connected
                ? "border border-green-800/50 bg-green-900/30 text-green-400"
                : "border border-red-800/50 bg-red-900/30 text-red-400"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                connected ? "animate-pulse bg-green-500" : "bg-red-500"
              }`}
            />
            {connected ? "Live" : "Disconnected"}
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <StatsBar
        summary={summary}
        liveStats={liveStats}
        health={health}
        loading={loading}
        timeline={timeline}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Left panel: Alert feed */}
        <div className="flex w-full min-h-[300px] max-h-[50vh] flex-col border-b border-gray-800 lg:max-h-none lg:w-[60%] lg:border-b-0 lg:border-r">
          <div className="border-b border-gray-800 bg-surface-card px-4 py-2">
            <h2 className="text-sm font-medium text-gray-300">
              Alert Feed
              <span className="ml-2 text-xs text-gray-500">
                ({alerts.length} alerts)
              </span>
            </h2>
          </div>
          <AlertFeed alerts={alerts} />
        </div>

        {/* Right panel: Traffic / Threats tabs */}
        <div className="flex w-full flex-col lg:w-[40%]">
          {/* Tab switcher */}
          <div className="flex border-b border-gray-800 bg-surface-card">
            <button
              onClick={() => setRightTab("traffic")}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                rightTab === "traffic"
                  ? "border-b-2 border-blue-500 text-blue-400"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Traffic
            </button>
            <button
              onClick={() => setRightTab("threats")}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                rightTab === "threats"
                  ? "border-b-2 border-blue-500 text-blue-400"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Threats
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div key={rightTab} className="animate-fade-in">
              {rightTab === "traffic" ? (
                <div className="flex flex-col gap-4">
                  <TrafficChart timeline={timeline} />
                  <ProtocolBreakdown
                    distribution={summary.protocol_distribution}
                  />
                </div>
              ) : (
                <ThreatHeatmap
                  alertsByCategory={summary.alerts_by_category}
                  alerts={alerts}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
