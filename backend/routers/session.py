"""
NetWatch Backend - session snapshot export router.

Writes a backend-side session snapshot log and alerts CSV on demand.
"""

import time
from pathlib import Path

from fastapi import APIRouter

from config import settings
from database import get_db
from models.alert import get_alerts
from models.stats import get_summary_stats
from utils.csv_export import generate_alerts_csv

router = APIRouter()


@router.post("/session/export")
async def export_session_snapshot() -> dict:
    """Persist a snapshot log and alerts CSV on the backend filesystem."""
    import main as app_main

    now = time.time()
    one_hour_ago = now - 3600
    stats = await get_summary_stats(one_hour_ago)

    # All alerts for CSV
    alerts, _ = await get_alerts(limit=100000)

    export_dir = Path(settings.SESSION_EXPORT_DIR)
    if not export_dir.is_absolute():
        export_dir = Path(__file__).resolve().parents[1] / export_dir
    export_dir.mkdir(parents=True, exist_ok=True)

    stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime(now))
    log_path = export_dir / f"netwatch-session-{stamp}.txt"
    csv_path = export_dir / f"netwatch-alerts-{stamp}.csv"

    critical = stats["severity_counts"].get("CRITICAL", 0)
    incidents = stats["total_alerts"]
    critical_pct = (critical / incidents * 100) if incidents else 0.0
    top_source = stats["top_src_ips"][0] if stats["top_src_ips"] else None

    # Find dominant protocol
    dominant_protocol = "—"
    if stats["protocol_distribution"]:
        dominant_protocol = max(stats["protocol_distribution"].items(), key=lambda item: item[1])[0]

    log_lines = [
        "NetWatch Session Snapshot",
        f"Generated: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(now))}",
        f"Uptime: {round(time.time() - app_main.start_time, 2)}s",
        f"Flows processed: {app_main.flows_processed}",
        f"Traffic volume: {stats['total_flows']}",
        f"Incidents: {incidents}",
        f"Critical incidents: {critical} ({critical_pct:.1f}%)",
        f"Alert pressure: {incidents}",
        f"Top source: {top_source['ip']} ({top_source['count']})" if top_source else "Top source: —",
        f"Dominant protocol: {dominant_protocol}",
        "",
        "Alerts CSV: netwatch-alerts-*.csv",
    ]
    log_path.write_text("\n".join(log_lines), encoding="utf-8")

    csv_data = generate_alerts_csv(alerts)
    csv_path.write_text(csv_data, encoding="utf-8")

    return {
        "ok": True,
        "log_path": str(log_path),
        "csv_path": str(csv_path),
        "incident_count": incidents,
        "critical_percentage": round(critical_pct, 1),
    }
