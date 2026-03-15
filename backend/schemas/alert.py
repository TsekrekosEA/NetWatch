"""
NetWatch Backend — Alert Pydantic schemas.

Defines the shape of alert data returned by the API and streamed over
WebSockets to the dashboard.
"""

from typing import Optional
from pydantic import BaseModel


class AlertOut(BaseModel):
    """Alert as returned to the dashboard."""

    id: int
    timestamp: float
    src_ip: str
    dst_ip: str
    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    protocol: str
    category: str
    severity: str
    stage: str
    details: Optional[dict] = None
    flow_duration: Optional[float] = None
    total_bytes: Optional[int] = None
    total_packets: Optional[int] = None


class AlertListResponse(BaseModel):
    """Paginated alert list response."""

    alerts: list[AlertOut]
    total: int


class IngestResponse(BaseModel):
    """Response after ingesting a flow record."""

    alerted: bool
    severity: Optional[str] = None
