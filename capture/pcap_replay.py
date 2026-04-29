"""
NetWatch Capture Service — PCAP file replay mode.

Reads a .pcap/.pcapng file and replays the packets through the flow
engine at original (or accelerated) timing. This lets the system be
demoed with real-world captured traffic without needing live network
access or root privileges.

Usage:
    DEMO_MODE=false REPLAY_PCAP=/data/capture.pcap python main.py

Environment variables:
    REPLAY_PCAP         Path to .pcap or .pcapng file
    REPLAY_SPEED        Multiplier for replay speed (default: 10.0 = 10x faster)
    REPLAY_LOOP         Set to "true" to loop the file indefinitely
"""

import logging
import os
import time
from typing import Any

from scapy.all import rdpcap, PcapReader, IP, IPv6, TCP, UDP, ICMP, ICMPv6EchoRequest, ICMPv6EchoReply  # type: ignore

from flow_engine import FlowEngine

logger = logging.getLogger("netwatch.capture.replay")


class PcapReplay:
    """Replays packets from a PCAP file through the flow engine."""

    def __init__(
        self,
        pcap_path: str,
        flow_engine: FlowEngine,
        speed: float = 10.0,
        loop: bool = False,
    ) -> None:
        self.pcap_path = pcap_path
        self.flow_engine = flow_engine
        self.speed = max(speed, 0.1)
        self.loop = loop
        self._running = True
        self._packets_replayed = 0
        self._flows_emitted = 0

    def start(self) -> None:
        """Replay packets. Blocks until file is consumed (or loop is off)."""
        if not os.path.isfile(self.pcap_path):
            logger.error("PCAP file not found: %s", self.pcap_path)
            return

        logger.info(
            "Starting PCAP replay: %s (speed=%.1fx, loop=%s)",
            self.pcap_path, self.speed, self.loop,
        )

        try:
            while self._running:
                self._replay_file()
                if not self.loop:
                    break
                logger.info(
                    "Replay loop complete (%d packets). Restarting...",
                    self._packets_replayed,
                )
        except KeyboardInterrupt:
            logger.info("Replay interrupted.")
        finally:
            self.stop()

    def _replay_file(self) -> None:
        """Read and replay a single pass of the PCAP file."""
        prev_ts: float | None = None

        with PcapReader(self.pcap_path) as reader:
            for pkt in reader:
                if not self._running:
                    break

                # Maintain inter-packet timing (scaled by speed)
                if hasattr(pkt, "time"):
                    pkt_ts = float(pkt.time)
                    if prev_ts is not None:
                        delay = (pkt_ts - prev_ts) / self.speed
                        if 0 < delay < 5.0:
                            time.sleep(delay)
                    prev_ts = pkt_ts

                self._process_packet(pkt)
                self._packets_replayed += 1

                if self._packets_replayed % 1000 == 0:
                    logger.info(
                        "Replayed %d packets (%d flows emitted)",
                        self._packets_replayed,
                        self.flow_engine.publisher._queue.qsize()
                        if hasattr(self.flow_engine.publisher, "_queue")
                        else 0,
                    )

    def _process_packet(self, packet: Any) -> None:
        """Extract 5-tuple + flags from a packet and feed to flow engine."""
        try:
            if packet.haslayer(IP):
                ip = packet[IP]
                src_ip = ip.src
                dst_ip = ip.dst
                payload_len = len(ip.payload)
            elif packet.haslayer(IPv6):
                ip = packet[IPv6]
                src_ip = ip.src
                dst_ip = ip.dst
                payload_len = len(ip.payload)
            else:
                return

            protocol = "OTHER"
            src_port = 0
            dst_port = 0
            flags: set[str] = set()

            if packet.haslayer(TCP):
                tcp = packet[TCP]
                protocol = "TCP"
                src_port = tcp.sport
                dst_port = tcp.dport
                flag_str = str(tcp.flags)
                if "S" in flag_str:
                    flags.add("SYN")
                if "A" in flag_str:
                    flags.add("ACK")
                if "F" in flag_str:
                    flags.add("FIN")
                if "R" in flag_str:
                    flags.add("RST")
                if "P" in flag_str:
                    flags.add("PSH")
            elif packet.haslayer(UDP):
                udp = packet[UDP]
                protocol = "UDP"
                src_port = udp.sport
                dst_port = udp.dport
            elif packet.haslayer(ICMP):
                protocol = "ICMP"
            elif packet.haslayer(ICMPv6EchoRequest) or packet.haslayer(ICMPv6EchoReply):
                protocol = "ICMP"

            self.flow_engine.add_packet(
                src_ip=src_ip,
                dst_ip=dst_ip,
                src_port=src_port,
                dst_port=dst_port,
                protocol=protocol,
                packet_len=len(packet),
                payload_len=payload_len,
                flags=flags,
            )

        except Exception as exc:
            logger.debug("Packet skipped during replay: %s", exc)

    def stop(self) -> None:
        """Stop replay and flush remaining flows."""
        self._running = False
        self.flow_engine.stop()
        logger.info(
            "Replay stopped. Total packets: %d",
            self._packets_replayed,
        )
