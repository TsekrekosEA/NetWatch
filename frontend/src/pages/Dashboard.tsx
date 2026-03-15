import { useState } from "react";
import { useAlertStream } from "../hooks/useAlertStream";
import { useStats } from "../hooks/useStats";
import { StatsBar } from "../components/StatsBar";
import { AlertFeed } from "../components/AlertFeed";
import { TrafficChart } from "../components/TrafficChart";
import { ProtocolBreakdown } from "../components/ProtocolBreakdown";
import { ThreatHeatmap } from "../components/ThreatHeatmap";

type RightTab = "traffic" | "threats";

export function Dashboard() {
  const { alerts, liveStats, connected } = useAlertStream();
  const { summary, timeline, health } = useStats();
  const [rightTab, setRightTab] = useState<RightTab>("traffic");

  return (
    <div className="flex h-screen flex-col overflow-hidden">
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
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              connected ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
            title={connected ? "WebSocket connected" : "Disconnected"}
          />
          <span className="text-xs text-gray-400">
            {connected ? "Live" : "Disconnected"}
          </span>
        </div>
      </header>

      {/* Stats bar */}
      <StatsBar
        summary={summary}
        liveStats={liveStats}
        health={health}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Alert feed (60%) */}
        <div className="flex w-[60%] flex-col border-r border-gray-800">
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

        {/* Right panel: Traffic / Threats tabs (40%) */}
        <div className="flex w-[40%] flex-col">
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
            {rightTab === "traffic" ? (
              <div className="flex flex-col gap-4">
                <TrafficChart timeline={timeline} alerts={alerts} />
                <ProtocolBreakdown
                  distribution={summary.protocol_distribution}
                />
              </div>
            ) : (
              <ThreatHeatmap
                topIps={summary.top_src_ips}
                alertsByCategory={summary.alerts_by_category}
                alerts={alerts}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
