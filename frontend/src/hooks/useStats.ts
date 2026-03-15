import { useEffect, useState, useCallback } from "react";
import { client } from "../api/client";

export interface StatsSummary {
  total_flows_1h: number;
  total_alerts_1h: number;
  alerts_by_severity: Record<string, number>;
  alerts_by_category: Record<string, number>;
  top_src_ips: Array<{ ip: string; count: number }>;
  protocol_distribution: Record<string, number>;
  bytes_per_minute: Array<{ ts: number; bytes: number }>;
}

export interface TimelineBucket {
  ts: number;
  flows: number;
  alerts: number;
  bytes: number;
}

export interface HealthStatus {
  status: string;
  ml_loaded: boolean;
  flows_processed: number;
  uptime_seconds: number;
}

const EMPTY_STATS: StatsSummary = {
  total_flows_1h: 0,
  total_alerts_1h: 0,
  alerts_by_severity: {},
  alerts_by_category: {},
  top_src_ips: [],
  protocol_distribution: {},
  bytes_per_minute: [],
};

export function useStats(pollIntervalMs = 10_000) {
  const [summary, setSummary] = useState<StatsSummary>(EMPTY_STATS);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [summaryRes, timelineRes, healthRes] = await Promise.all([
        client.get<StatsSummary>("/stats/summary"),
        client.get<TimelineBucket[]>("/stats/timeline?minutes=10"),
        client.get<HealthStatus>("/health"),
      ]);
      setSummary(summaryRes.data);
      setTimeline(timelineRes.data);
      setHealth(healthRes.data);
    } catch {
      // Silently retry on next interval
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, pollIntervalMs);
    return () => clearInterval(id);
  }, [fetchAll, pollIntervalMs]);

  return { summary, timeline, health };
}
