import { useState, useEffect, useRef } from "react";
import type { Alert } from "../hooks/useAlertStream";

interface CriticalAlertToastProps {
  alerts: Alert[];
}

export function CriticalAlertToast({ alerts }: CriticalAlertToastProps) {
  const [toasts, setToasts] = useState<Alert[]>([]);
  const prevLenRef = useRef(alerts.length);

  useEffect(() => {
    const newCount = alerts.length - prevLenRef.current;
    prevLenRef.current = alerts.length;
    if (newCount > 0) {
      const newAlerts = alerts.slice(0, newCount);
      const critical = newAlerts.filter((a) => a.severity === "CRITICAL");
      if (critical.length > 0) {
        setToasts((prev) => [...critical, ...prev].slice(0, 3));
      }
    }
  }, [alerts]);

  // Auto-dismiss oldest toast after 5 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(0, -1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-slide-in rounded-lg border border-red-800/50 bg-red-950/90 px-4 py-3 text-sm text-red-200 shadow-lg backdrop-blur-sm"
        >
          <div className="font-medium">CRITICAL Alert</div>
          <div className="mt-0.5 text-xs text-red-400">
            {t.src_ip} — {t.category}
          </div>
        </div>
      ))}
    </div>
  );
}
