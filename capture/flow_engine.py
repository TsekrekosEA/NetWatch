"""
NetWatch Capture Service — Flow engine.

Assembles individual packets into bidirectional 5-tuple network flows,
tracks per-flow state (packet counts, byte counts, inter-arrival times,
flag distributions), and emits completed flows with a 20-dimensional
feature vector to the publisher.
"""

import logging
import time
import threading
from typing import Optional

from features import extract_features
from publisher import FlowPublisher

logger = logging.getLogger("netwatch.capture.flow_engine")


class FlowState:
    """Mutable state for a single active flow."""

    __slots__ = (
        "src_ip", "dst_ip", "src_port", "dst_port", "protocol",
        "first_ts", "last_ts",
        "fwd_packets", "bwd_packets", "fwd_bytes", "bwd_bytes",
        "fwd_iats", "bwd_iats", "last_fwd_ts", "last_bwd_ts",
        "syn_count", "ack_count", "fin_count", "rst_count", "psh_count",
        "packet_lengths", "packet_count",
    )

    def __init__(
        self,
        src_ip: str,
        dst_ip: str,
        src_port: int,
        dst_port: int,
        protocol: str,
    ) -> None:
        self.src_ip = src_ip
        self.dst_ip = dst_ip
        self.src_port = src_port
        self.dst_port = dst_port
        self.protocol = protocol

        now = time.time()
        self.first_ts = now
        self.last_ts = now

        self.fwd_packets = 0
        self.bwd_packets = 0
        self.fwd_bytes = 0
        self.bwd_bytes = 0

        self.fwd_iats: list[float] = []
        self.bwd_iats: list[float] = []
        self.last_fwd_ts: float = 0.0
        self.last_bwd_ts: float = 0.0

        self.syn_count = 0
        self.ack_count = 0
        self.fin_count = 0
        self.rst_count = 0
        self.psh_count = 0

        self.packet_lengths: list[int] = []
        self.packet_count = 0


def _canonical_key(
    src_ip: str, dst_ip: str, src_port: int, dst_port: int, protocol: str,
) -> tuple:
    """Create a canonical (bidirectional) flow key — lower IP first."""
    if (src_ip, src_port) <= (dst_ip, dst_port):
        return (src_ip, dst_ip, src_port, dst_port, protocol)
    return (dst_ip, src_ip, dst_port, src_port, protocol)


class FlowEngine:
    """Assembles packets into flows and emits them when complete."""

    def __init__(
        self,
        publisher: FlowPublisher,
        flow_timeout: int = 120,
        max_flow_packets: int = 10000,
    ) -> None:
        self.publisher = publisher
        self.flow_timeout = flow_timeout
        self.max_flow_packets = max_flow_packets
        self._flows: dict[tuple, FlowState] = {}
        self._lock = threading.Lock()

        # Start a background thread that expires stale flows
        self._running = True
        self._timeout_thread = threading.Thread(
            target=self._expire_loop, daemon=True,
        )
        self._timeout_thread.start()

    def add_packet(
        self,
        src_ip: str,
        dst_ip: str,
        src_port: int,
        dst_port: int,
        protocol: str,
        packet_len: int,
        payload_len: int,
        flags: set[str],
    ) -> None:
        """Add a packet to its corresponding flow."""
        key = _canonical_key(src_ip, dst_ip, src_port, dst_port, protocol)
        now = time.time()

        with self._lock:
            if key not in self._flows:
                self._flows[key] = FlowState(
                    src_ip=key[0],
                    dst_ip=key[1],
                    src_port=key[2],
                    dst_port=key[3],
                    protocol=protocol,
                )

            flow = self._flows[key]
            flow.last_ts = now
            flow.packet_count += 1
            flow.packet_lengths.append(packet_len)

            # Determine direction: forward = matches flow's canonical src
            is_forward = (src_ip == flow.src_ip and src_port == flow.src_port)

            if is_forward:
                flow.fwd_packets += 1
                flow.fwd_bytes += packet_len
                if flow.last_fwd_ts > 0:
                    flow.fwd_iats.append(now - flow.last_fwd_ts)
                flow.last_fwd_ts = now
            else:
                flow.bwd_packets += 1
                flow.bwd_bytes += packet_len
                if flow.last_bwd_ts > 0:
                    flow.bwd_iats.append(now - flow.last_bwd_ts)
                flow.last_bwd_ts = now

            # TCP flag accounting
            if "SYN" in flags:
                flow.syn_count += 1
            if "ACK" in flags:
                flow.ack_count += 1
            if "FIN" in flags:
                flow.fin_count += 1
            if "RST" in flags:
                flow.rst_count += 1
            if "PSH" in flags:
                flow.psh_count += 1

            # Check completion conditions
            should_emit = False
            if "FIN" in flags or "RST" in flags:
                should_emit = True
            if flow.packet_count >= self.max_flow_packets:
                should_emit = True

            if should_emit:
                self._emit_flow(key, flow)
                del self._flows[key]

    def _emit_flow(self, key: tuple, flow: FlowState) -> None:
        """Extract features and publish a completed flow."""
        features = extract_features(flow)
        self.publisher.send_flow(flow, features)

    def _expire_loop(self) -> None:
        """Periodically check for timed-out flows and emit them."""
        while self._running:
            time.sleep(10)
            now = time.time()
            expired_keys: list[tuple] = []

            with self._lock:
                for key, flow in self._flows.items():
                    if now - flow.last_ts > self.flow_timeout:
                        expired_keys.append(key)

                for key in expired_keys:
                    flow = self._flows.pop(key)
                    self._emit_flow(key, flow)

            if expired_keys:
                logger.debug("Expired %d flows", len(expired_keys))

    def stop(self) -> None:
        """Stop the timeout thread and flush remaining flows."""
        self._running = False
        with self._lock:
            for key, flow in list(self._flows.items()):
                self._emit_flow(key, flow)
            self._flows.clear()
