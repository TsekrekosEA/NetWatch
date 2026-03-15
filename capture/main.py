"""
NetWatch Capture Service — Entrypoint.

Starts either a live packet capture loop (using Scapy + libpcap) or a
synthetic demo traffic generator, depending on the DEMO_MODE environment
variable. Completed flows are posted to the backend ingest endpoint.
"""

import logging
import os
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
    backend_url = os.environ.get("BACKEND_URL", "http://backend:8000")
    capture_token = os.environ.get("CAPTURE_TOKEN", "change-me-in-production")

    logger.info("=" * 60)
    logger.info("NetWatch Capture Service")
    logger.info("  Mode:       %s", "DEMO" if demo_mode else "LIVE")
    logger.info("  Backend:    %s", backend_url)
    logger.info("=" * 60)

    # Wait for backend to be ready
    _wait_for_backend(backend_url)

    if demo_mode:
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
