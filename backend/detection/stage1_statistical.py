"""
NetWatch Backend — Stage 1: Statistical baseline engine.

Maintains a rolling window of feature values and flags flows whose features
deviate more than STAT_THRESHOLD standard deviations from the running mean.
This catches volume-based attacks (port scans, DoS floods, SYN storms)
immediately with zero training data.
"""

import logging
from collections import deque
from typing import Optional

import numpy as np

from config import settings

logger = logging.getLogger("netwatch.detection.stage1")

FEATURE_NAMES = [
    "duration", "total_fwd_packets", "total_bwd_packets",
    "total_fwd_bytes", "total_bwd_bytes", "fwd_packet_rate",
    "bwd_packet_rate", "fwd_byte_rate", "bwd_byte_rate",
    "mean_iat_fwd", "std_iat_fwd", "mean_iat_bwd", "std_iat_bwd",
    "syn_flag_count", "ack_flag_count", "fin_flag_count",
    "rst_flag_count", "psh_flag_count", "mean_packet_length",
    "std_packet_length",
]


class RollingBaseline:
    """Per-feature rolling window baseline with z-score anomaly detection."""

    def __init__(self, window_size: int = 1000, threshold: float = 3.5) -> None:
        self.window_size = window_size
        self.threshold = threshold
        self._windows: list[deque[float]] = [
            deque(maxlen=window_size) for _ in range(20)
        ]

    def update_and_check(self, features: list[float]) -> dict:
        """
        Add a feature vector to the rolling window and check for anomalies.

        Returns a dict with:
          - anomalous: bool
          - anomalous_features: list of (feature_name, z_score) tuples
          - category: str (derived from which features are anomalous)
          - severity: str (LOW / MEDIUM / HIGH)
        """
        anomalous_features: list[tuple[str, float]] = []

        for i, value in enumerate(features):
            window = self._windows[i]

            if len(window) >= 30:
                arr = np.array(window)
                mean = arr.mean()
                std = arr.std()

                if std > 1e-10:
                    z_score = abs(value - mean) / std
                    if z_score > self.threshold:
                        anomalous_features.append((FEATURE_NAMES[i], round(z_score, 2)))

            window.append(value)

        if not anomalous_features:
            return {
                "anomalous": False,
                "anomalous_features": [],
                "category": None,
                "severity": None,
            }

        category = _classify_anomaly(anomalous_features)
        severity = _compute_severity(len(anomalous_features))

        return {
            "anomalous": True,
            "anomalous_features": anomalous_features,
            "category": category,
            "severity": severity,
        }


def _classify_anomaly(anomalous_features: list[tuple[str, float]]) -> str:
    """Derive an attack category from the set of anomalous features."""
    names = {name for name, _ in anomalous_features}

    if "syn_flag_count" in names and "duration" in names:
        return "Port Scan"
    if "fwd_packet_rate" in names and "fwd_byte_rate" in names:
        return "DoS/Flood"
    if "rst_flag_count" in names:
        return "RST Flood"
    if "total_fwd_packets" in names and "mean_packet_length" in names:
        return "SYN Storm"
    return "Statistical Anomaly"


def _compute_severity(anomalous_count: int) -> str:
    """Map number of anomalous features to severity level."""
    if anomalous_count >= 6:
        return "HIGH"
    if anomalous_count >= 3:
        return "MEDIUM"
    return "LOW"


# Module-level singleton used by the pipeline
baseline = RollingBaseline(
    window_size=settings.ROLLING_WINDOW_SIZE,
    threshold=settings.STAT_THRESHOLD,
)
