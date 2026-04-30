"""
Tests for the optimized statistics logic.
"""

import time
import pytest
from models.stats import get_summary_stats, get_stats_timeline
from models.alert import insert_alert, insert_flow_stat

@pytest.mark.asyncio
async def test_get_summary_stats(test_db):
    """Test that summary stats correctly aggregate data."""
    # Insert some data
    now = time.time()
    await insert_alert(
        src_ip="1.1.1.1", dst_ip="2.2.2.2", src_port=80, dst_port=80,
        protocol="TCP", category="DoS", severity="HIGH", stage="Both",
        details={}, flow_duration=1.0, total_bytes=100, total_packets=10
    )
    await insert_flow_stat(protocol="TCP", total_bytes=500, total_packets=50, alerted=True)

    stats = await get_summary_stats(now - 3600)
    assert stats["total_flows"] == 1
    assert stats["total_alerts"] == 1
    assert stats["severity_counts"]["HIGH"] == 1
    assert stats["category_counts"]["DoS"] == 1
    assert stats["protocol_distribution"]["TCP"] == 1

@pytest.mark.asyncio
async def test_get_stats_timeline_buckets(test_db):
    """Test that the optimized timeline correctly buckets data by minute."""
    now = time.time()
    # Align to minute boundary
    base_ts = int(now / 60) * 60

    # Insert stats in two different minutes
    # Minute 0
    await insert_flow_stat(protocol="TCP", total_bytes=1000, total_packets=10, alerted=False)
    # Minute -1 (simulated by adjusting timestamp in a custom insert or just using current)
    # Since insert_flow_stat uses time.time(), we can't easily backdate without mocking or direct SQL

    from database import get_db
    db = await get_db()
    await db.execute(
        "INSERT INTO flow_stats (timestamp, protocol, total_flows, total_bytes, total_packets) VALUES (?, ?, 1, ?, ?)",
        (base_ts - 120, "UDP", 2000, 20)
    )
    await db.commit()
    await db.close()

    timeline = await get_stats_timeline(minutes=5)
    assert len(timeline) == 5

    # Minute 0 (last element)
    assert timeline[-1]["flows"] == 1
    assert timeline[-1]["bytes"] == 1000

    # Minute -2 (3rd element from end)
    assert timeline[-3]["flows"] == 1
    assert timeline[-3]["bytes"] == 2000

    # Minute -1 (between them) should be zero
    assert timeline[-2]["flows"] == 0
