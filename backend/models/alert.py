"""
NetWatch Backend — Alert model for database operations.

Provides helper functions for inserting and querying alerts from the SQLite
database. Uses raw SQL via aiosqlite for performance and simplicity.
"""

import json
import time
from typing import Optional

from database import get_db


async def insert_alert(
    src_ip: str,
    dst_ip: str,
    src_port: Optional[int],
    dst_port: Optional[int],
    protocol: str,
    category: str,
    severity: str,
    stage: str,
    details: dict,
    flow_duration: float,
    total_bytes: int,
    total_packets: int,
) -> dict:
    """Insert a new alert and return it as a dictionary."""
    ts = time.time()
    db = await get_db()
    try:
        cursor = await db.execute(
            """
            INSERT INTO alerts
                (timestamp, src_ip, dst_ip, src_port, dst_port, protocol,
                 category, severity, stage, details, flow_duration,
                 total_bytes, total_packets)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ts, src_ip, dst_ip, src_port, dst_port, protocol,
                category, severity, stage, json.dumps(details),
                flow_duration, total_bytes, total_packets,
            ),
        )
        await db.commit()
        return {
            "id": cursor.lastrowid,
            "timestamp": ts,
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "src_port": src_port,
            "dst_port": dst_port,
            "protocol": protocol,
            "category": category,
            "severity": severity,
            "stage": stage,
            "details": details,
            "flow_duration": flow_duration,
            "total_bytes": total_bytes,
            "total_packets": total_packets,
        }
    finally:
        await db.close()


async def insert_flow_stat(
    protocol: str,
    total_bytes: int,
    total_packets: int,
    alerted: bool,
) -> None:
    """Record a flow statistics entry."""
    db = await get_db()
    try:
        await db.execute(
            """
            INSERT INTO flow_stats (timestamp, protocol, total_flows, total_bytes,
                                     total_packets, alert_count)
            VALUES (?, ?, 1, ?, ?, ?)
            """,
            (time.time(), protocol, total_bytes, total_packets, 1 if alerted else 0),
        )
        await db.commit()
    finally:
        await db.close()


async def get_alerts(
    limit: int = 100,
    offset: int = 0,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    src_ip: Optional[str] = None,
    since: Optional[float] = None,
    until: Optional[float] = None,
) -> tuple[list[dict], int]:
    """Query alerts with optional filters. Returns (alerts, total_count)."""
    db = await get_db()
    try:
        conditions = []
        params: list = []

        if severity:
            conditions.append("severity = ?")
            params.append(severity)
        if category:
            conditions.append("category = ?")
            params.append(category)
        if src_ip:
            conditions.append("src_ip = ?")
            params.append(src_ip)
        if since:
            conditions.append("timestamp >= ?")
            params.append(since)
        if until:
            conditions.append("timestamp <= ?")
            params.append(until)

        where = ""
        if conditions:
            where = "WHERE " + " AND ".join(conditions)

        count_row = await db.execute(
            f"SELECT COUNT(*) FROM alerts {where}", params
        )
        total = (await count_row.fetchone())[0]

        cursor = await db.execute(
            f"""
            SELECT * FROM alerts {where}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
            """,
            params + [limit, offset],
        )
        rows = await cursor.fetchall()
        alerts = [_row_to_dict(row) for row in rows]
        return alerts, total
    finally:
        await db.close()


async def get_recent_alerts(limit: int = 20) -> list[dict]:
    """Return the most recent alerts."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ?",
            (limit,),
        )
        rows = await cursor.fetchall()
        return [_row_to_dict(row) for row in rows]
    finally:
        await db.close()


def _row_to_dict(row) -> dict:
    """Convert a database row to a plain dictionary."""
    d = dict(row)
    if isinstance(d.get("details"), str):
        try:
            d["details"] = json.loads(d["details"])
        except (json.JSONDecodeError, TypeError):
            pass
    return d
