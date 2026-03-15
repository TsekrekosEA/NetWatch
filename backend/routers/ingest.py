"""
NetWatch Backend — Ingest router.

Receives completed flow records from the capture service, runs the
detection pipeline, records flow statistics, and triggers WebSocket
alert pushes.
"""

import logging
from fastapi import APIRouter, Header, HTTPException

from config import settings
from schemas.flow import FlowRecord
from schemas.alert import IngestResponse
from detection.pipeline import run_pipeline
from models.alert import insert_flow_stat

logger = logging.getLogger("netwatch.ingest")

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_flow(
    flow: FlowRecord,
    x_capture_token: str = Header(...),
) -> IngestResponse:
    """Receive a flow record from the capture service and analyse it."""
    if x_capture_token != settings.CAPTURE_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid capture token")

    # Increment global flow counter (import lazily to avoid circular import)
    import main as app_main
    app_main.flows_processed += 1

    result = await run_pipeline(flow)

    total_bytes = flow.total_fwd_bytes + flow.total_bwd_bytes
    total_packets = flow.total_fwd_packets + flow.total_bwd_packets
    await insert_flow_stat(
        protocol=flow.protocol,
        total_bytes=total_bytes,
        total_packets=total_packets,
        alerted=result.alerted,
    )

    return result
