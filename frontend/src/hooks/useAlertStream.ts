import { useEffect, useRef, useState, useCallback } from "react";

export interface Alert {
  id: number;
  timestamp: number;
  src_ip: string;
  dst_ip: string;
  src_port: number | null;
  dst_port: number | null;
  protocol: string;
  category: string;
  severity: string;
  stage: string;
  details: Record<string, unknown> | null;
  flow_duration: number | null;
  total_bytes: number | null;
  total_packets: number | null;
}

interface StatsUpdate {
  flows_last_minute: number;
  alerts_last_minute: number;
}

interface UseAlertStreamReturn {
  alerts: Alert[];
  liveStats: StatsUpdate;
  connected: boolean;
}

const WS_URL = import.meta.env.PROD
  ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`
  : (import.meta.env.VITE_WS_URL ?? "ws://localhost:8001");
const MAX_ALERTS = 500;

export function useAlertStream(): UseAlertStreamReturn {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [liveStats, setLiveStats] = useState<StatsUpdate>({
    flows_last_minute: 0,
    alerts_last_minute: 0,
  });
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1000);

  const connect = useCallback(() => {
    // Guard: don't open a second connection if one is already alive.
    // This prevents React StrictMode's double-mount from creating two
    // concurrent WebSocket connections and duplicating every alert.
    const state = wsRef.current?.readyState;
    if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/ws/alerts`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectDelay.current = 1000;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "alert") {
          setAlerts((prev) => {
            // Deduplicate by ID — safety net against any duplicate deliveries.
            if (prev.some((a) => a.id === (msg.data as Alert).id)) return prev;
            const next = [msg.data as Alert, ...prev];
            return next.length > MAX_ALERTS ? next.slice(0, MAX_ALERTS) : next;
          });
        } else if (msg.type === "stats_update") {
          setLiveStats(msg.data as StatsUpdate);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Exponential backoff reconnect
      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(delay * 2, 30_000);
      setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      // Clear onclose before closing so the reconnect timer is NOT scheduled
      // during StrictMode cleanup — only genuine disconnects should reconnect.
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { alerts, liveStats, connected };
}
