"""
NetWatch Backend — Alerts and statistics REST router.

Provides paginated alert history, recent alerts, summary statistics,
and a timeline endpoint for the dashboard charts.
"""

import time
import csv
import io
import logging
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from database import get_db
from models.alert import get_alerts, get_recent_alerts
from schemas.alert import AlertOut, AlertListResponse

logger = logging.getLogger("netwatch.alerts")

router = APIRouter()


@router.get("/alerts", response_model=AlertListResponse)
async def list_alerts(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    severity: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    src_ip: Optional[str] = Query(None),
    since: Optional[float] = Query(None),
    until: Optional[float] = Query(None),
) -> AlertListResponse:
    """Paginated alert listing with optional filters."""
    alerts, total = await get_alerts(
        limit=limit, offset=offset, severity=severity,
        category=category, src_ip=src_ip, since=since, until=until,
    )
    return AlertListResponse(
        alerts=[AlertOut(**a) for a in alerts],
        total=total,
    )


@router.get("/alerts/recent", response_model=list[AlertOut])
async def recent_alerts(
    limit: int = Query(20, ge=1, le=100),
) -> list[AlertOut]:
    """Return the N most recent alerts."""
    alerts = await get_recent_alerts(limit=limit)
    return [AlertOut(**a) for a in alerts]


@router.get("/stats/summary")
async def stats_summary() -> dict:
    """Dashboard summary statistics for the last hour."""
    one_hour_ago = time.time() - 3600
    db = await get_db()
    try:
        # Total flows in the last hour
        row = await db.execute(
            "SELECT COALESCE(SUM(total_flows), 0) FROM flow_stats WHERE timestamp >= ?",
            (one_hour_ago,),
        )
        total_flows_1h = (await row.fetchone())[0]

        # Total alerts in the last hour
        row = await db.execute(
            "SELECT COUNT(*) FROM alerts WHERE timestamp >= ?",
            (one_hour_ago,),
        )
        total_alerts_1h = (await row.fetchone())[0]

        # Alerts by severity
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

        # Alerts by category
        cursor = await db.execute(
            """
            SELECT category, COUNT(*) as cnt
            FROM alerts WHERE timestamp >= ?
            GROUP BY category
            """,
            (one_hour_ago,),
        )
        category_counts = {r[0]: r[1] for r in await cursor.fetchall()}

        # Top source IPs
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

        # Protocol distribution
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

        # Bytes per minute (last 60 minutes)
        bytes_per_minute = []
        now = time.time()
        for i in range(60):
            bucket_start = now - (60 - i) * 60
            bucket_end = bucket_start + 60
            row = await db.execute(
                """
                SELECT COALESCE(SUM(total_bytes), 0)
                FROM flow_stats
                WHERE timestamp >= ? AND timestamp < ?
                """,
                (bucket_start, bucket_end),
            )
            total = (await row.fetchone())[0]
            bytes_per_minute.append({"ts": bucket_start, "bytes": total})

        return {
            "total_flows_1h": total_flows_1h,
            "total_alerts_1h": total_alerts_1h,
            "alerts_by_severity": severity_counts,
            "alerts_by_category": category_counts,
            "top_src_ips": top_src_ips,
            "protocol_distribution": protocol_dist,
            "bytes_per_minute": bytes_per_minute,
        }
    finally:
        await db.close()


@router.get("/stats/timeline")
async def stats_timeline(
    minutes: int = Query(60, ge=1, le=1440),
) -> list[dict]:
    """Per-minute bucketed timeline of flows, alerts, and bytes."""
    now = time.time()
    db = await get_db()
    try:
        timeline = []
        for i in range(minutes):
            bucket_start = now - (minutes - i) * 60
            bucket_end = bucket_start + 60

            row = await db.execute(
                """
                SELECT COALESCE(SUM(total_flows), 0),
                       COALESCE(SUM(total_bytes), 0)
                FROM flow_stats
                WHERE timestamp >= ? AND timestamp < ?
                """,
                (bucket_start, bucket_end),
            )
            fs = await row.fetchone()

            row = await db.execute(
                """
                SELECT COUNT(*)
                FROM alerts
                WHERE timestamp >= ? AND timestamp < ?
                """,
                (bucket_start, bucket_end),
            )
            alert_count = (await row.fetchone())[0]

            timeline.append({
                "ts": bucket_start,
                "flows": fs[0],
                "alerts": alert_count,
                "bytes": fs[1],
            })

        return timeline
    finally:
        await db.close()


@router.get("/alerts/export")
async def export_alerts_csv(
    severity: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    src_ip: Optional[str] = Query(None),
    since: Optional[float] = Query(None),
    until: Optional[float] = Query(None),
) -> StreamingResponse:
    """Export alerts as a CSV file with optional filters."""
    alerts, _ = await get_alerts(
        limit=10000, offset=0, severity=severity,
        category=category, src_ip=src_ip, since=since, until=until,
    )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "timestamp", "src_ip", "dst_ip", "src_port", "dst_port",
        "protocol", "category", "severity", "stage", "flow_duration",
        "total_bytes", "total_packets",
    ])
    for a in alerts:
        writer.writerow([
            a.get("id"), a.get("timestamp"), a.get("src_ip"), a.get("dst_ip"),
            a.get("src_port"), a.get("dst_port"), a.get("protocol"),
            a.get("category"), a.get("severity"), a.get("stage"),
            a.get("flow_duration"), a.get("total_bytes"), a.get("total_packets"),
        ])

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=netwatch_alerts.csv"},
    )
