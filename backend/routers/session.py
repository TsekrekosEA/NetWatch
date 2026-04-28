"""
NetWatch Backend - session snapshot export router.

Writes a backend-side session snapshot log and alerts CSV on demand.
"""

import csv
import io
import time
from pathlib import Path

from fastapi import APIRouter

from config import settings
from database import get_db

router = APIRouter()


async def _build_snapshot() -> dict:
    now = time.time()
    one_hour_ago = now - 3600
    db = await get_db()
    try:
        row = await db.execute(
            "SELECT COALESCE(SUM(total_flows), 0) FROM flow_stats WHERE timestamp >= ?",
            (one_hour_ago,),
        )
        total_flows_1h = (await row.fetchone())[0]

        row = await db.execute(
            "SELECT COUNT(*) FROM alerts WHERE timestamp >= ?",
            (one_hour_ago,),
        )
        total_alerts_1h = (await row.fetchone())[0]

        cursor = await db.execute(
            """
            SELECT severity, COUNT(*) as cnt
            FROM alerts WHERE timestamp >= ?
            GROUP BY severity
            """,
            (one_hour_ago,),
        )
        severity_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        for srow in await cursor.fetchall():
            severity_counts[srow[0]] = srow[1]

        cursor = await db.execute(
            """
            SELECT src_ip, COUNT(*) as cnt
            FROM alerts WHERE timestamp >= ?
            GROUP BY src_ip
            ORDER BY cnt DESC
            LIMIT 10
            """,
            (one_hour_ago,),
        )
        top_src_ips = [{"ip": r[0], "count": r[1]} for r in await cursor.fetchall()]

        cursor = await db.execute(
            """
            SELECT protocol, COALESCE(SUM(total_flows), 0) as cnt
            FROM flow_stats WHERE timestamp >= ?
            GROUP BY protocol
            """,
            (one_hour_ago,),
        )
        protocol_dist = {"TCP": 0, "UDP": 0, "ICMP": 0, "OTHER": 0}
        for r in await cursor.fetchall():
            proto = r[0] if r[0] in protocol_dist else "OTHER"
            protocol_dist[proto] += r[1]

        cursor = await db.execute(
            "SELECT * FROM alerts ORDER BY timestamp DESC"
        )
        alerts = [dict(row) for row in await cursor.fetchall()]

        return {
            "generated_at": now,
            "uptime_seconds": None,
            "total_flows_1h": total_flows_1h,
            "total_alerts_1h": total_alerts_1h,
            "alerts_by_severity": severity_counts,
            "top_src_ips": top_src_ips,
            "protocol_distribution": protocol_dist,
            "alerts": alerts,
        }
    finally:
        await db.close()


@router.post("/session/export")
async def export_session_snapshot() -> dict:
    """Persist a snapshot log and alerts CSV on the backend filesystem."""
    import main as app_main

    snapshot = await _build_snapshot()
    export_dir = Path(settings.SESSION_EXPORT_DIR)
    if not export_dir.is_absolute():
        export_dir = Path(__file__).resolve().parents[1] / export_dir
    export_dir.mkdir(parents=True, exist_ok=True)

    stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime(snapshot["generated_at"]))
    log_path = export_dir / f"netwatch-session-{stamp}.txt"
    csv_path = export_dir / f"netwatch-alerts-{stamp}.csv"

    critical = snapshot["alerts_by_severity"].get("CRITICAL", 0)
    incidents = snapshot["total_alerts_1h"]
    critical_pct = (critical / incidents * 100) if incidents else 0.0
    top_source = snapshot["top_src_ips"][0] if snapshot["top_src_ips"] else None
    dominant_protocol = max(snapshot["protocol_distribution"].items(), key=lambda item: item[1])[0] if snapshot["protocol_distribution"].get("TCP") or snapshot["protocol_distribution"].get("UDP") or snapshot["protocol_distribution"].get("ICMP") or snapshot["protocol_distribution"].get("OTHER") else "—"

    log_lines = [
        "NetWatch Session Snapshot",
        f"Generated: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(snapshot['generated_at']))}",
        f"Uptime: {round(time.time() - app_main.start_time, 2)}s",
        f"Flows processed: {app_main.flows_processed}",
        f"Traffic volume: {snapshot['total_flows_1h']}",
        f"Incidents: {incidents}",
        f"Critical incidents: {critical} ({critical_pct:.1f}%)",
        f"Alert pressure: {snapshot['total_alerts_1h']}",
        f"Top source: {top_source['ip']} ({top_source['count']})" if top_source else "Top source: —",
        f"Dominant protocol: {dominant_protocol}",
        "",
        "Alerts CSV: netwatch-alerts-*.csv",
    ]
    log_path.write_text("\n".join(log_lines), encoding="utf-8")

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "timestamp", "src_ip", "dst_ip", "src_port", "dst_port",
        "protocol", "category", "severity", "stage", "flow_duration",
        "total_bytes", "total_packets",
    ])
    for a in snapshot["alerts"]:
        writer.writerow([
            a.get("id"), a.get("timestamp"), a.get("src_ip"), a.get("dst_ip"),
            a.get("src_port"), a.get("dst_port"), a.get("protocol"),
            a.get("category"), a.get("severity"), a.get("stage"),
            a.get("flow_duration"), a.get("total_bytes"), a.get("total_packets"),
        ])
    csv_path.write_text(buf.getvalue(), encoding="utf-8")

    return {
        "ok": True,
        "log_path": str(log_path),
        "csv_path": str(csv_path),
        "incident_count": incidents,
        "critical_percentage": round(critical_pct, 1),
    }