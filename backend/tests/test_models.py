"""Tests for the alert model layer (database operations)."""

import time
import pytest
import database
from models.alert import insert_alert, get_alerts, get_recent_alerts, insert_flow_stat


@pytest.mark.asyncio
async def test_insert_and_retrieve_alert(test_db):
    alert = await insert_alert(
        src_ip="10.0.0.1",
        dst_ip="192.168.1.1",
        src_port=12345,
        dst_port=80,
        protocol="TCP",
        category="DoS",
        severity="HIGH",
        stage="ml",
        details={"test": True},
        flow_duration=1.5,
        total_bytes=8000,
        total_packets=18,
    )
    assert alert["id"] is not None
    assert alert["src_ip"] == "10.0.0.1"
    assert alert["severity"] == "HIGH"

    alerts, total = await get_alerts(limit=10)
    assert total >= 1
    assert any(a["id"] == alert["id"] for a in alerts)


@pytest.mark.asyncio
async def test_get_alerts_severity_filter(test_db):
    await insert_alert(
        src_ip="10.0.0.2", dst_ip="1.1.1.1", src_port=1111, dst_port=443,
        protocol="TCP", category="BruteForce", severity="CRITICAL", stage="both",
        details={}, flow_duration=0.5, total_bytes=1000, total_packets=5,
    )
    await insert_alert(
        src_ip="10.0.0.3", dst_ip="1.1.1.1", src_port=2222, dst_port=443,
        protocol="TCP", category="Scan", severity="LOW", stage="statistical",
        details={}, flow_duration=0.1, total_bytes=200, total_packets=2,
    )

    critical, total_c = await get_alerts(severity="CRITICAL")
    assert all(a["severity"] == "CRITICAL" for a in critical)

    low, total_l = await get_alerts(severity="LOW")
    assert all(a["severity"] == "LOW" for a in low)


@pytest.mark.asyncio
async def test_get_alerts_category_filter(test_db):
    await insert_alert(
        src_ip="10.0.0.5", dst_ip="2.2.2.2", src_port=3333, dst_port=22,
        protocol="TCP", category="BruteForce", severity="HIGH", stage="ml",
        details={}, flow_duration=10.0, total_bytes=50000, total_packets=100,
    )

    results, total = await get_alerts(category="BruteForce")
    assert total >= 1
    assert all(a["category"] == "BruteForce" for a in results)


@pytest.mark.asyncio
async def test_get_alerts_src_ip_filter(test_db):
    await insert_alert(
        src_ip="172.16.0.99", dst_ip="8.8.8.8", src_port=4444, dst_port=53,
        protocol="UDP", category="DoS", severity="MEDIUM", stage="statistical",
        details={}, flow_duration=0.3, total_bytes=500, total_packets=3,
    )

    results, total = await get_alerts(src_ip="172.16.0.99")
    assert total >= 1
    assert all(a["src_ip"] == "172.16.0.99" for a in results)


@pytest.mark.asyncio
async def test_get_recent_alerts(test_db):
    for i in range(5):
        await insert_alert(
            src_ip=f"10.0.0.{i}", dst_ip="1.1.1.1", src_port=i, dst_port=80,
            protocol="TCP", category="Test", severity="LOW", stage="statistical",
            details={}, flow_duration=0.1, total_bytes=100, total_packets=1,
        )

    recent = await get_recent_alerts(limit=3)
    assert len(recent) == 3
    # Should be in descending timestamp order
    assert recent[0]["timestamp"] >= recent[1]["timestamp"]


@pytest.mark.asyncio
async def test_insert_flow_stat(test_db):
    """Flow stats insert should not raise."""
    await insert_flow_stat(
        protocol="TCP", total_bytes=5000,
        total_packets=10, alerted=True,
    )
    await insert_flow_stat(
        protocol="UDP", total_bytes=1000,
        total_packets=3, alerted=False,
    )
