"""
NetWatch Backend — Alerts and statistics REST router.

Provides paginated alert history, recent alerts, summary statistics,
and a timeline endpoint for the dashboard charts.
"""

import time
import io
import logging
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from models.alert import get_alerts, get_recent_alerts
from models.stats import get_summary_stats, get_stats_timeline
from schemas.alert import AlertOut, AlertListResponse
from utils.csv_export import generate_alerts_csv

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
    stats = await get_summary_stats(one_hour_ago)

    # Format for the frontend dashboard response
    timeline = await get_stats_timeline(60)
    bytes_per_minute = [{"ts": t["ts"], "bytes": t["bytes"]} for t in timeline]

    return {
        "total_flows_1h": stats["total_flows"],
        "total_alerts_1h": stats["total_alerts"],
        "alerts_by_severity": stats["severity_counts"],
        "alerts_by_category": stats["category_counts"],
        "top_src_ips": stats["top_src_ips"],
        "protocol_distribution": stats["protocol_distribution"],
        "bytes_per_minute": bytes_per_minute,
    }


@router.get("/stats/timeline")
async def stats_timeline(
    minutes: int = Query(60, ge=1, le=1440),
) -> list[dict]:
    """Per-minute bucketed timeline of flows, alerts, and bytes."""
    return await get_stats_timeline(minutes)


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

    csv_data = generate_alerts_csv(alerts)
    buf = io.StringIO(csv_data)

    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=netwatch_alerts.csv"},
    )
