"""
NetWatch Backend — Shared statistics and aggregation logic.
"""

import time
from database import get_db


async def get_summary_stats(since_ts: float) -> dict:
    """Calculate summary statistics for the period since since_ts."""
    db = await get_db()
    try:
        # Total flows
        row = await db.execute(
            "SELECT COALESCE(SUM(total_flows), 0) FROM flow_stats WHERE timestamp >= ?",
            (since_ts,),
        )
        total_flows = (await row.fetchone())[0]

        # Total alerts
        row = await db.execute(
            "SELECT COUNT(*) FROM alerts WHERE timestamp >= ?",
            (since_ts,),
        )
        total_alerts = (await row.fetchone())[0]

        # Alerts by severity
        cursor = await db.execute(
            """
            SELECT severity, COUNT(*) as cnt
            FROM alerts WHERE timestamp >= ?
            GROUP BY severity
            """,
            (since_ts,),
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
            (since_ts,),
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
            (since_ts,),
        )
        top_src_ips = [{"ip": r[0], "count": r[1]} for r in await cursor.fetchall()]

        # Protocol distribution
        cursor = await db.execute(
            """
            SELECT protocol, COALESCE(SUM(total_flows), 0) as cnt
            FROM flow_stats WHERE timestamp >= ?
            GROUP BY protocol
            """,
            (since_ts,),
        )
        protocol_dist = {"TCP": 0, "UDP": 0, "ICMP": 0, "OTHER": 0}
        for r in await cursor.fetchall():
            proto = r[0] if r[0] in protocol_dist else "OTHER"
            protocol_dist[proto] += r[1]

        return {
            "total_flows": total_flows,
            "total_alerts": total_alerts,
            "severity_counts": severity_counts,
            "category_counts": category_counts,
            "top_src_ips": top_src_ips,
            "protocol_distribution": protocol_dist,
        }
    finally:
        await db.close()


async def get_stats_timeline(minutes: int = 60) -> list[dict]:
    """
    Get per-minute bucketed timeline of flows, alerts, and bytes using a single query.
    """
    now = time.time()
    since_ts = now - (minutes * 60)
    db = await get_db()
    try:
        # We use STRFTIME to group by minute.
        # Since we want a full timeline even for empty buckets, we'll post-process.

        # Query flow stats
        cursor = await db.execute(
            """
            SELECT CAST((timestamp / 60) AS INTEGER) * 60 as bucket,
                   SUM(total_flows), SUM(total_bytes)
            FROM flow_stats
            WHERE timestamp >= ?
            GROUP BY bucket
            ORDER BY bucket ASC
            """,
            (since_ts,),
        )
        flow_buckets = {r[0]: (r[1], r[2]) for r in await cursor.fetchall()}

        # Query alert counts
        cursor = await db.execute(
            """
            SELECT CAST((timestamp / 60) AS INTEGER) * 60 as bucket,
                   COUNT(*)
            FROM alerts
            WHERE timestamp >= ?
            GROUP BY bucket
            ORDER BY bucket ASC
            """,
            (since_ts,),
        )
        alert_buckets = {r[0]: r[1] for r in await cursor.fetchall()}

        timeline = []
        # Ensure every minute in the window is represented
        # We go up to the current minute
        start_bucket = int(since_ts / 60) * 60
        for i in range(minutes + 1):
            ts = start_bucket + (i * 60)
            f_stats = flow_buckets.get(ts, (0, 0))
            a_count = alert_buckets.get(ts, 0)
            timeline.append({
                "ts": float(ts),
                "flows": f_stats[0],
                "alerts": a_count,
                "bytes": f_stats[1],
            })

        # Return only the last 'minutes' buckets to keep it consistent
        return timeline[-minutes:]
    finally:
        await db.close()
