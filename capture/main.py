"""
NetWatch Capture Service — Entrypoint.

Starts either a live packet capture loop (using Scapy + libpcap) or a
synthetic demo traffic generator, depending on the DEMO_MODE environment
variable. Completed flows are posted to the backend ingest endpoint.
"""

import logging
import os
import signal
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("netwatch.capture")


def main() -> None:
    """Select capture mode and start the pipeline."""
    demo_mode = os.environ.get("DEMO_MODE", "true").lower() in ("true", "1", "yes")
    replay_pcap = os.environ.get("REPLAY_PCAP", "")
    backend_url = os.environ.get("BACKEND_URL", "http://backend:8000")
    capture_token = os.environ.get("CAPTURE_TOKEN", "change-me-in-production")

    mode_label = "REPLAY" if replay_pcap else ("DEMO" if demo_mode else "LIVE")
    logger.info("=" * 60)
    logger.info("NetWatch Capture Service")
    logger.info("  Mode:       %s", mode_label)
    logger.info("  Backend:    %s", backend_url)
    if replay_pcap:
        logger.info("  PCAP file:  %s", replay_pcap)
    logger.info("=" * 60)

    # Wait for backend to be ready
    _wait_for_backend(backend_url)

    if replay_pcap:
        from flow_engine import FlowEngine
        from publisher import FlowPublisher
        from pcap_replay import PcapReplay

        publisher = FlowPublisher(backend_url, capture_token)
        flow_timeout = int(os.environ.get("FLOW_TIMEOUT", "120"))
        max_packets = int(os.environ.get("MAX_FLOW_PACKETS", "10000"))
        engine = FlowEngine(
            publisher=publisher,
            flow_timeout=flow_timeout,
            max_flow_packets=max_packets,
        )

        speed = float(os.environ.get("REPLAY_SPEED", "10.0"))
        loop = os.environ.get("REPLAY_LOOP", "false").lower() in ("true", "1", "yes")
        replayer = PcapReplay(
            pcap_path=replay_pcap,
            flow_engine=engine,
            speed=speed,
            loop=loop,
        )

        def _handle_sigterm(signum, frame):
            logger.info("SIGTERM received — shutting down gracefully.")
            replayer.stop()
            sys.exit(0)

        signal.signal(signal.SIGTERM, _handle_sigterm)
        replayer.start()

    elif demo_mode:
        from demo_traffic import DemoTrafficGenerator
        generator = DemoTrafficGenerator(backend_url, capture_token)
        generator.run()
    else:
        interface = os.environ.get("INTERFACE", "eth0")
        logger.info("Starting live capture on interface: %s", interface)
        from capture import LiveCapture
        from flow_engine import FlowEngine
        from publisher import FlowPublisher

        publisher = FlowPublisher(backend_url, capture_token)
        flow_timeout = int(os.environ.get("FLOW_TIMEOUT", "120"))
        max_packets = int(os.environ.get("MAX_FLOW_PACKETS", "10000"))
        engine = FlowEngine(
            publisher=publisher,
            flow_timeout=flow_timeout,
            max_flow_packets=max_packets,
        )
        live_capture = LiveCapture(interface=interface, flow_engine=engine)

        # Graceful shutdown on SIGTERM (Docker stop)
        def _handle_sigterm(signum, frame):
            logger.info("SIGTERM received — shutting down gracefully.")
            live_capture.stop()
            sys.exit(0)

        signal.signal(signal.SIGTERM, _handle_sigterm)
        live_capture.start()


def _wait_for_backend(backend_url: str, timeout: int = 60) -> None:
    """Block until the backend health endpoint responds."""
    import httpx

    health_url = f"{backend_url}/health"
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = httpx.get(health_url, timeout=5)
            if resp.status_code == 200:
                logger.info("Backend is ready.")
                return
        except Exception:
            pass
        logger.info("Waiting for backend at %s …", health_url)
        time.sleep(2)
    logger.error("Backend not reachable after %ds — starting anyway.", timeout)


if __name__ == "__main__":
    main()
