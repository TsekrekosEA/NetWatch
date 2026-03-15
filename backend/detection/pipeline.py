"""
NetWatch Backend — Detection pipeline orchestrator.

Runs incoming flow records through stage 1 (statistical baseline) and
stage 2 (ML classifier), combines the results, persists alerts, and
broadcasts them to WebSocket clients.
"""

import logging

from schemas.flow import FlowRecord
from schemas.alert import IngestResponse
from detection.stage1_statistical import baseline
from detection.severity import combine_stages
from models.alert import insert_alert
from routers.ws import broadcast_alert

logger = logging.getLogger("netwatch.detection.pipeline")


async def run_pipeline(flow: FlowRecord) -> IngestResponse:
    """Execute the full two-stage detection pipeline on a flow record."""
    features = flow.feature_vector()

    # ── Stage 1: Statistical baseline ─────────────────────────────────
    stat_result = baseline.update_and_check(features)

    # ── Stage 2: ML classifier ────────────────────────────────────────
    from main import ml_classifier
    ml_result = ml_classifier.predict(features)

    # ── Combine results ───────────────────────────────────────────────
    category, severity, stage = combine_stages(stat_result, ml_result)

    if not category:
        return IngestResponse(alerted=False, severity=None)

    # ── Build anomaly details for the alert ───────────────────────────
    details: dict = {}
    if stat_result.get("anomalous"):
        details["statistical"] = {
            "anomalous_features": stat_result["anomalous_features"],
            "stat_category": stat_result["category"],
            "stat_severity": stat_result["severity"],
        }
    if ml_result and ml_result.get("anomalous"):
        details["ml"] = {
            "if_score": ml_result["if_score"],
            "rf_class": ml_result["rf_class"],
            "rf_confidence": ml_result["rf_confidence"],
            "ml_category": ml_result["category"],
            "ml_severity": ml_result["severity"],
        }

    total_bytes = flow.total_fwd_bytes + flow.total_bwd_bytes
    total_packets = flow.total_fwd_packets + flow.total_bwd_packets

    alert = await insert_alert(
        src_ip=flow.src_ip,
        dst_ip=flow.dst_ip,
        src_port=flow.src_port,
        dst_port=flow.dst_port,
        protocol=flow.protocol,
        category=category,
        severity=severity,
        stage=stage,
        details=details,
        flow_duration=flow.duration,
        total_bytes=total_bytes,
        total_packets=total_packets,
    )

    logger.info(
        "ALERT [%s] %s → %s:%s  category=%s  severity=%s  stage=%s",
        severity, flow.src_ip, flow.dst_ip, flow.dst_port,
        category, severity, stage,
    )

    await broadcast_alert(alert)

    return IngestResponse(alerted=True, severity=severity)
