"""
NetWatch Capture Service — Flow publisher.

Sends completed flow records (5-tuple metadata + 20-dimensional feature
vector) to the backend ingest endpoint via HTTP POST with the shared
authentication token.
"""

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger("netwatch.capture.publisher")


class FlowPublisher:
    """Publishes completed flow records to the backend."""

    def __init__(self, backend_url: str, capture_token: str) -> None:
        self.ingest_url = f"{backend_url}/ingest"
        self.capture_token = capture_token
        self._client = httpx.Client(timeout=10)
        self._failures = 0

    def send_flow(self, flow: Any, features: list[float]) -> bool:
        """
        POST a flow record to the backend ingest endpoint.

        Returns True on success, False on failure.
        """
        payload = {
            "src_ip": flow.src_ip,
            "dst_ip": flow.dst_ip,
            "src_port": flow.src_port,
            "dst_port": flow.dst_port,
            "protocol": flow.protocol,
            "timestamp": time.time(),
            "duration": features[0],
            "total_fwd_packets": int(features[1]),
            "total_bwd_packets": int(features[2]),
            "total_fwd_bytes": int(features[3]),
            "total_bwd_bytes": int(features[4]),
            "fwd_packet_rate": features[5],
            "bwd_packet_rate": features[6],
            "fwd_byte_rate": features[7],
            "bwd_byte_rate": features[8],
            "mean_iat_fwd": features[9],
            "std_iat_fwd": features[10],
            "mean_iat_bwd": features[11],
            "std_iat_bwd": features[12],
            "syn_flag_count": int(features[13]),
            "ack_flag_count": int(features[14]),
            "fin_flag_count": int(features[15]),
            "rst_flag_count": int(features[16]),
            "psh_flag_count": int(features[17]),
            "mean_packet_length": features[18],
            "std_packet_length": features[19],
        }

        try:
            resp = self._client.post(
                self.ingest_url,
                json=payload,
                headers={"X-Capture-Token": self.capture_token},
            )
            if resp.status_code == 200:
                self._failures = 0
                data = resp.json()
                if data.get("alerted"):
                    logger.info(
                        "ALERT: %s → %s:%d [%s]",
                        flow.src_ip, flow.dst_ip, flow.dst_port,
                        data.get("severity", "?"),
                    )
                return True
            else:
                self._failures += 1
                logger.warning(
                    "Ingest returned %d: %s", resp.status_code, resp.text[:200],
                )
                return False

        except Exception as exc:
            self._failures += 1
            if self._failures <= 3 or self._failures % 50 == 0:
                logger.error("Failed to send flow: %s (failures: %d)", exc, self._failures)
            return False
