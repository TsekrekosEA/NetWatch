"""Tests for REST API endpoints using FastAPI TestClient."""

import time
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

import database


@pytest_asyncio.fixture()
async def client(test_db):
    """Async test client for the FastAPI app with a clean DB."""
    from main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_endpoint(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "ml_loaded" in data
    assert "uptime_seconds" in data


@pytest.mark.asyncio
async def test_alerts_empty(client):
    resp = await client.get("/alerts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["alerts"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_alerts_recent_empty(client):
    resp = await client.get("/alerts/recent")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_ingest_requires_token(client, sample_flow_dict):
    """Ingest without a valid token should return 403."""
    resp = await client.post(
        "/ingest", json=sample_flow_dict,
        headers={"X-Capture-Token": "wrong-token"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_ingest_valid_flow(client, sample_flow_dict):
    """A valid flow should be accepted and processed."""
    resp = await client.post(
        "/ingest", json=sample_flow_dict,
        headers={"X-Capture-Token": "change-me-in-production"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "alerted" in data


@pytest.mark.asyncio
async def test_stats_summary(client):
    resp = await client.get("/stats/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_flows_1h" in data
    assert "total_alerts_1h" in data
    assert "alerts_by_severity" in data
    assert "protocol_distribution" in data


@pytest.mark.asyncio
async def test_stats_timeline(client):
    resp = await client.get("/stats/timeline?minutes=5")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 5
    assert "flows" in data[0]
    assert "alerts" in data[0]


@pytest.mark.asyncio
async def test_alerts_filter_severity(client, sample_flow_dict):
    """Severity filter should work on the alerts endpoint."""
    resp = await client.get("/alerts?severity=CRITICAL")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_alerts_filter_category(client):
    resp = await client.get("/alerts?category=DoS")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_alerts_filter_src_ip(client):
    resp = await client.get("/alerts?src_ip=10.0.0.1")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_alerts_export_csv(client):
    resp = await client.get("/alerts/export")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "netwatch_alerts.csv" in resp.headers.get("content-disposition", "")
