"""
NetWatch Capture Service — Synthetic demo traffic generator.

When DEMO_MODE=true, this module generates realistic benign network flows
at ~50 flows/minute and periodically injects attack patterns (port scans,
SYN floods, SSH brute force, DNS floods) so the system can be demonstrated
without root privileges or live network access.

All flow values use realistic statistical distributions:
  - Byte counts: log-normal distribution
  - Inter-arrival times: exponential distribution
  - Durations: log-normal distribution
"""

import logging
import random
import time
from typing import Any

import numpy as np
import httpx

logger = logging.getLogger("netwatch.capture.demo")

# Reproducible but varied
_RNG = np.random.default_rng(seed=42)

# Realistic IP ranges
_INTERNAL_IPS = [f"10.0.1.{i}" for i in range(10, 60)]
_EXTERNAL_IPS = [
    "8.8.8.8", "1.1.1.1", "13.107.42.14", "142.250.74.110",
    "104.18.32.7", "151.101.1.140", "199.232.69.194", "93.184.216.34",
    "23.215.0.136", "52.84.150.11", "172.217.14.206", "31.13.65.36",
]
_ATTACKER_IPS = [
    "185.220.101.45", "194.26.29.102", "45.155.205.233", "89.248.167.131",
]

# Common ports for benign traffic
_HTTP_PORTS = [80, 443, 8080, 8443]
_DNS_PORT = 53
_SSH_PORT = 22

# Attack cycling state
_ATTACK_TYPES = ["port_scan", "syn_flood", "ssh_brute_force", "dns_flood"]


class DemoTrafficGenerator:
    """Generates synthetic network flows for demonstration purposes."""

    def __init__(self, backend_url: str, capture_token: str) -> None:
        self.ingest_url = f"{backend_url}/ingest"
        self.capture_token = capture_token
        self._client = httpx.Client(timeout=10)
        self._attack_index = 0
        self._flows_sent = 0

    def run(self) -> None:
        """Main loop: emit benign flows and periodic attacks."""
        logger.info("Demo traffic generator started.")
        last_attack_time = time.time()

        try:
            while True:
                # Generate a benign flow
                flow = self._generate_benign_flow()
                self._send_flow(flow)
                self._flows_sent += 1

                # Every 60 seconds, inject an attack pattern
                if time.time() - last_attack_time >= 60:
                    attack_type = _ATTACK_TYPES[self._attack_index % len(_ATTACK_TYPES)]
                    logger.info("Injecting attack: %s", attack_type)
                    self._inject_attack(attack_type)
                    self._attack_index += 1
                    last_attack_time = time.time()

                # ~50 flows/minute → ~1.2s between flows
                time.sleep(random.uniform(0.8, 1.6))

        except KeyboardInterrupt:
            logger.info("Demo generator stopped. Total flows sent: %d", self._flows_sent)

    def _generate_benign_flow(self) -> dict:
        """Generate a single realistic benign flow."""
        src_ip = random.choice(_INTERNAL_IPS)
        dst_ip = random.choice(_EXTERNAL_IPS)

        # Traffic type distribution: 60% HTTP/S, 25% DNS, 15% SSH/other
        roll = random.random()
        if roll < 0.60:
            return self._benign_http(src_ip, dst_ip)
        elif roll < 0.85:
            return self._benign_dns(src_ip, dst_ip)
        else:
            return self._benign_ssh(src_ip, dst_ip)

    def _benign_http(self, src_ip: str, dst_ip: str) -> dict:
        """HTTP/HTTPS session flow."""
        dst_port = random.choice(_HTTP_PORTS)
        duration = float(_RNG.lognormal(mean=1.5, sigma=1.0))
        fwd_pkts = int(_RNG.lognormal(mean=2.5, sigma=0.8)) + 1
        bwd_pkts = int(_RNG.lognormal(mean=3.0, sigma=1.0)) + 1
        fwd_bytes = int(_RNG.lognormal(mean=7.0, sigma=1.5))
        bwd_bytes = int(_RNG.lognormal(mean=9.0, sigma=1.5))

        return self._build_flow(
            src_ip=src_ip, dst_ip=dst_ip,
            src_port=random.randint(49152, 65535), dst_port=dst_port,
            protocol="TCP", duration=duration,
            fwd_pkts=fwd_pkts, bwd_pkts=bwd_pkts,
            fwd_bytes=fwd_bytes, bwd_bytes=bwd_bytes,
            syn=1, ack=fwd_pkts + bwd_pkts, fin=2, rst=0, psh=max(1, bwd_pkts // 2),
        )

    def _benign_dns(self, src_ip: str, dst_ip: str) -> dict:
        """DNS query/response flow."""
        duration = float(_RNG.exponential(scale=0.05))
        return self._build_flow(
            src_ip=src_ip, dst_ip=random.choice(["8.8.8.8", "1.1.1.1"]),
            src_port=random.randint(49152, 65535), dst_port=_DNS_PORT,
            protocol="UDP", duration=duration,
            fwd_pkts=1, bwd_pkts=1,
            fwd_bytes=random.randint(40, 80), bwd_bytes=random.randint(60, 512),
            syn=0, ack=0, fin=0, rst=0, psh=0,
        )

    def _benign_ssh(self, src_ip: str, dst_ip: str) -> dict:
        """SSH session flow."""
        duration = float(_RNG.lognormal(mean=3.0, sigma=1.5))
        fwd_pkts = int(_RNG.lognormal(mean=4.0, sigma=1.0)) + 3
        bwd_pkts = int(_RNG.lognormal(mean=4.0, sigma=1.0)) + 3

        return self._build_flow(
            src_ip=src_ip, dst_ip=dst_ip,
            src_port=random.randint(49152, 65535), dst_port=_SSH_PORT,
            protocol="TCP", duration=duration,
            fwd_pkts=fwd_pkts, bwd_pkts=bwd_pkts,
            fwd_bytes=int(_RNG.lognormal(mean=8.0, sigma=1.0)),
            bwd_bytes=int(_RNG.lognormal(mean=8.5, sigma=1.0)),
            syn=1, ack=fwd_pkts + bwd_pkts, fin=2, rst=0, psh=fwd_pkts,
        )

    def _inject_attack(self, attack_type: str) -> None:
        """Inject an attack pattern as a burst of flows."""
        attacker = random.choice(_ATTACKER_IPS)
        target = random.choice(_INTERNAL_IPS)

        if attack_type == "port_scan":
            self._attack_port_scan(attacker, target)
        elif attack_type == "syn_flood":
            self._attack_syn_flood(attacker, target)
        elif attack_type == "ssh_brute_force":
            self._attack_ssh_brute(attacker, target)
        elif attack_type == "dns_flood":
            self._attack_dns_flood(attacker, target)

    def _attack_port_scan(self, attacker: str, target: str) -> None:
        """Port scan: 200 flows to sequential ports with short duration."""
        logger.info("Port scan: %s → %s (200 ports)", attacker, target)
        base_port = random.randint(1, 800)
        for i in range(200):
            flow = self._build_flow(
                src_ip=attacker, dst_ip=target,
                src_port=random.randint(49152, 65535),
                dst_port=base_port + i,
                protocol="TCP",
                duration=float(_RNG.exponential(scale=0.01)),
                fwd_pkts=1, bwd_pkts=random.choice([0, 1]),
                fwd_bytes=random.randint(40, 60),
                bwd_bytes=random.randint(0, 60),
                syn=1, ack=random.choice([0, 1]),
                fin=0, rst=random.choice([0, 1]), psh=0,
            )
            self._send_flow(flow)
            time.sleep(0.01)

    def _attack_syn_flood(self, attacker: str, target: str) -> None:
        """SYN flood: 500 flows, high SYN count, near-zero duration."""
        logger.info("SYN flood: %s → %s:80 (500 flows)", attacker, target)
        for _ in range(500):
            flow = self._build_flow(
                src_ip=attacker, dst_ip=target,
                src_port=random.randint(1024, 65535), dst_port=80,
                protocol="TCP",
                duration=float(_RNG.exponential(scale=0.001)),
                fwd_pkts=random.randint(5, 50), bwd_pkts=0,
                fwd_bytes=random.randint(200, 3000), bwd_bytes=0,
                syn=random.randint(5, 50), ack=0, fin=0, rst=0, psh=0,
            )
            self._send_flow(flow)
            time.sleep(0.005)

    def _attack_ssh_brute(self, attacker: str, target: str) -> None:
        """SSH brute force: repeated flows to port 22 with regular timing."""
        logger.info("SSH brute force: %s → %s:22 (100 attempts)", attacker, target)
        for _ in range(100):
            flow = self._build_flow(
                src_ip=attacker, dst_ip=target,
                src_port=random.randint(49152, 65535), dst_port=_SSH_PORT,
                protocol="TCP",
                duration=float(_RNG.lognormal(mean=0.5, sigma=0.3)),
                fwd_pkts=random.randint(10, 30), bwd_pkts=random.randint(8, 25),
                fwd_bytes=random.randint(500, 2000),
                bwd_bytes=random.randint(400, 1500),
                syn=1, ack=random.randint(15, 40), fin=1, rst=0,
                psh=random.randint(5, 15),
            )
            self._send_flow(flow)
            time.sleep(0.05)

    def _attack_dns_flood(self, attacker: str, target: str) -> None:
        """DNS flood: high UDP flow rate to port 53."""
        logger.info("DNS flood: %s → %s:53 (300 flows)", attacker, target)
        for _ in range(300):
            flow = self._build_flow(
                src_ip=attacker, dst_ip=target,
                src_port=random.randint(1024, 65535), dst_port=_DNS_PORT,
                protocol="UDP",
                duration=float(_RNG.exponential(scale=0.002)),
                fwd_pkts=random.randint(1, 5), bwd_pkts=random.choice([0, 1]),
                fwd_bytes=random.randint(40, 512),
                bwd_bytes=random.randint(0, 512),
                syn=0, ack=0, fin=0, rst=0, psh=0,
            )
            self._send_flow(flow)
            time.sleep(0.008)

    def _build_flow(
        self, *, src_ip: str, dst_ip: str, src_port: int, dst_port: int,
        protocol: str, duration: float,
        fwd_pkts: int, bwd_pkts: int, fwd_bytes: int, bwd_bytes: int,
        syn: int, ack: int, fin: int, rst: int, psh: int,
    ) -> dict:
        """Construct a flow record with derived features."""
        duration = max(duration, 0.0)
        duration_safe = duration if duration > 1e-6 else 1e-6

        # Compute IATs from duration and packet counts
        mean_iat_fwd = (duration / fwd_pkts) if fwd_pkts > 1 else 0.0
        std_iat_fwd = mean_iat_fwd * float(_RNG.uniform(0.1, 0.5)) if fwd_pkts > 1 else 0.0
        mean_iat_bwd = (duration / bwd_pkts) if bwd_pkts > 1 else 0.0
        std_iat_bwd = mean_iat_bwd * float(_RNG.uniform(0.1, 0.5)) if bwd_pkts > 1 else 0.0

        total_pkts = max(fwd_pkts + bwd_pkts, 1)
        total_bytes = fwd_bytes + bwd_bytes
        mean_pkt_len = total_bytes / total_pkts
        std_pkt_len = mean_pkt_len * float(_RNG.uniform(0.2, 0.6))

        return {
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "src_port": src_port,
            "dst_port": dst_port,
            "protocol": protocol,
            "timestamp": time.time(),
            "duration": round(duration, 6),
            "total_fwd_packets": fwd_pkts,
            "total_bwd_packets": bwd_pkts,
            "total_fwd_bytes": fwd_bytes,
            "total_bwd_bytes": bwd_bytes,
            "fwd_packet_rate": round(fwd_pkts / duration_safe, 4),
            "bwd_packet_rate": round(bwd_pkts / duration_safe, 4),
            "fwd_byte_rate": round(fwd_bytes / duration_safe, 4),
            "bwd_byte_rate": round(bwd_bytes / duration_safe, 4),
            "mean_iat_fwd": round(mean_iat_fwd, 6),
            "std_iat_fwd": round(std_iat_fwd, 6),
            "mean_iat_bwd": round(mean_iat_bwd, 6),
            "std_iat_bwd": round(std_iat_bwd, 6),
            "syn_flag_count": syn,
            "ack_flag_count": ack,
            "fin_flag_count": fin,
            "rst_flag_count": rst,
            "psh_flag_count": psh,
            "mean_packet_length": round(mean_pkt_len, 2),
            "std_packet_length": round(std_pkt_len, 2),
        }

    def _send_flow(self, flow: dict) -> None:
        """Send a flow to the backend ingest endpoint."""
        try:
            self._client.post(
                self.ingest_url,
                json=flow,
                headers={"X-Capture-Token": self.capture_token},
            )
        except Exception as exc:
            logger.debug("Failed to send demo flow: %s", exc)
