"""
NetWatch Capture Service — Live packet capture via Scapy.

Uses Scapy's AsyncSniffer to capture packets from a network interface
and feed them to the flow engine for assembly into 5-tuple flows.
"""

import logging
import os
from typing import Any

from scapy.all import AsyncSniffer, IP, IPv6, TCP, UDP, ICMP, ICMPv6EchoRequest, ICMPv6EchoReply  # type: ignore

from flow_engine import FlowEngine

logger = logging.getLogger("netwatch.capture.live")


class LiveCapture:
    """Captures live packets from a network interface using Scapy."""

    def __init__(self, interface: str, flow_engine: FlowEngine) -> None:
        self.interface = interface
        self.flow_engine = flow_engine
        self._sniffer: Any = None

    def start(self) -> None:
        """Begin sniffing packets. Blocks until interrupted."""
        bpf = os.environ.get("BPF_FILTER", "ip or ip6")
        logger.info("Starting packet capture on %s (filter: %s)", self.interface, bpf)
        self._sniffer = AsyncSniffer(
            iface=self.interface,
            prn=self._handle_packet,
            filter=bpf,
            store=False,
        )
        self._sniffer.start()

        try:
            self._sniffer.join()
        except KeyboardInterrupt:
            logger.info("Capture interrupted by user.")
            self.stop()

    def stop(self) -> None:
        """Stop the packet sniffer and flush flows."""
        if self._sniffer and self._sniffer.running:
            self._sniffer.stop()
        self.flow_engine.stop()
        logger.info("Capture stopped.")

    def _handle_packet(self, packet: Any) -> None:
        """Process a single captured packet."""
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
            flags = set()

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
            logger.debug("Malformed packet skipped: %s", exc)
