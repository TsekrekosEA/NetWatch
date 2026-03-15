"""
NetWatch Backend — Prometheus metrics.

Exposes counters and gauges that track flows processed, alerts fired,
detection latency, and WebSocket connections. Scraped by Prometheus
at /metrics.
"""

from prometheus_client import Counter, Gauge, Histogram, Info

# ── Counters ──────────────────────────────────────────────────────────────
FLOWS_TOTAL = Counter(
    "netwatch_flows_total",
    "Total network flows ingested",
    ["protocol"],
)

ALERTS_TOTAL = Counter(
    "netwatch_alerts_total",
    "Total alerts fired",
    ["severity", "category", "stage"],
)

ALERTS_RATE_LIMITED = Counter(
    "netwatch_alerts_rate_limited_total",
    "Alerts suppressed by rate limiter",
)

# ── Gauges ────────────────────────────────────────────────────────────────
WS_CONNECTIONS = Gauge(
    "netwatch_ws_connections",
    "Active WebSocket dashboard connections",
)

ML_LOADED = Gauge(
    "netwatch_ml_loaded",
    "Whether ML models are loaded (1=yes, 0=no)",
)

ACTIVE_FLOWS_CAPTURE = Gauge(
    "netwatch_active_flows",
    "Active flows in the flow engine (capture side, reported via health)",
)

# ── Histograms ────────────────────────────────────────────────────────────
PIPELINE_LATENCY = Histogram(
    "netwatch_pipeline_duration_seconds",
    "Detection pipeline processing time per flow",
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0),
)

# ── Info ──────────────────────────────────────────────────────────────────
BUILD_INFO = Info(
    "netwatch_build",
    "Build information",
)
BUILD_INFO.info({"version": "1.0.0", "component": "backend"})
