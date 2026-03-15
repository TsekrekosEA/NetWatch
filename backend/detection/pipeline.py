"""
NetWatch Backend — Detection pipeline orchestrator.

Runs incoming flow records through stage 1 (statistical baseline) and
stage 2 (ML classifier), combines the results, persists alerts, and
broadcasts them to WebSocket clients.
"""

import logging
import time

from config import settings
from schemas.flow import FlowRecord
from schemas.alert import IngestResponse
from detection.stage1_statistical import baseline
from detection.severity import combine_stages
from models.alert import insert_alert
from routers.ws import broadcast_alert
from metrics import ALERTS_TOTAL, ALERTS_RATE_LIMITED

logger = logging.getLogger("netwatch.detection.pipeline")

# Alert rate limiter: tracks last alert time per (src_ip, category) pair
_last_alert: dict[tuple[str, str], float] = {}


def _is_rate_limited(src_ip: str, category: str) -> bool:
    """Return True if we recently fired an alert for this src_ip+category."""
    window = settings.ALERT_RATE_LIMIT_SECONDS
    if window <= 0:
        return False
    key = (src_ip, category)
    now = time.time()
    last = _last_alert.get(key, 0.0)
    if now - last < window:
        return True
    _last_alert[key] = now
    # Prune stale entries every 500 inserts to bound memory
    if len(_last_alert) > 5000:
        cutoff = now - window * 2
        stale = [k for k, v in _last_alert.items() if v < cutoff]
        for k in stale:
            del _last_alert[k]
    return False


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

    # ── Rate limiting ─────────────────────────────────────────────────
    if _is_rate_limited(flow.src_ip, category):
        logger.debug(
            "Rate-limited alert: %s → %s category=%s",
            flow.src_ip, flow.dst_ip, category,
        )
        ALERTS_RATE_LIMITED.inc()
        return IngestResponse(alerted=False, severity=None)

    # ── Build anomaly details for the alert ───────────────────────────
    details: dict = {}
    if stat_result.get("anomalous"):
        details["statistical"] = {
            "anomalous_features": stat_result["anomalous_features"],
            "stat_category": stat_result["category"],
            "stat_severity": stat_result["severity"],
        }
    if ml_result:
        details["ml"] = {
            "if_score": ml_result.get("if_score"),
            "rf_class": ml_result.get("rf_class"),
            "rf_confidence": ml_result.get("rf_confidence"),
            "ml_category": ml_result.get("category") or "Benign",
            "ml_severity": ml_result.get("severity"),
            "ml_anomalous": ml_result.get("anomalous", False),
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

    ALERTS_TOTAL.labels(severity=severity, category=category, stage=stage).inc()

    logger.info(
        "ALERT [%s] %s → %s:%s  category=%s  severity=%s  stage=%s",
        severity, flow.src_ip, flow.dst_ip, flow.dst_port,
        category, severity, stage,
    )

    await broadcast_alert(alert)

    return IngestResponse(alerted=True, severity=severity)
