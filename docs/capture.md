# NetWatch Capture Service

The Capture Service is a specialized Python component responsible for packet sniffing, flow reassembly, and feature engineering.

## 1. Operation Modes

The service can be configured via environment variables to operate in one of three modes:

- **LIVE Mode** (`DEMO_MODE=false`, `REPLAY_PCAP=""`):
    - Uses Scapy's `sniff()` function to capture raw packets from a physical interface (e.g., `eth0`).
    - Requires `NET_ADMIN` and `NET_RAW` Linux capabilities.
- **REPLAY Mode** (`REPLAY_PCAP="/path/to/file.pcap"`):
    - Reads packets from a PCAP file.
    - Supports a `REPLAY_SPEED` multiplier (e.g., `10.0` for 10x real-time speed).
    - Can loop indefinitely with `REPLAY_LOOP=true`.
- **DEMO Mode** (`DEMO_MODE=true`):
    - Generates synthetic traffic patterns.
    - Simulates attacks like SYN floods, port scans, and DNS floods for testing and demonstration.

## 2. The Flow Engine (`flow_engine.py`)

Individual packets are stateless. The Flow Engine assembles them into bidirectional **Flows** identified by a 5-tuple:
- Source IP
- Destination IP
- Source Port
- Destination Port
- Protocol

### Key Logic:
- **Canonical Keying**: To ensure both directions of a conversation are tracked in the same flow object, the 5-tuple is sorted (lower IP/Port first).
- **Flow State**: Tracks packet counts, byte counts, inter-arrival times (IAT), and TCP flag distributions for both forward and backward directions.
- **Flow Expiry**:
    - **Natural Finish**: Flows are emitted when a `FIN` or `RST` flag is detected.
    - **Timeout**: Idle flows are expired after `FLOW_TIMEOUT` (default 120s).
    - **Resource Limit**: If the flow table exceeds 50,000 entries, the oldest flows are evicted.

## 3. Feature Extraction (`features.py`)

Once a flow is complete, it is transformed into a **20-dimensional feature vector**. These features are carefully selected to provide the detection pipeline with enough context to identify anomalies:

1.  `duration`: Total time from first to last packet.
2.  `total_fwd_packets` / `total_bwd_packets`: Volume in both directions.
3.  `total_fwd_bytes` / `total_bwd_bytes`: Data throughput.
4.  `fwd_packet_rate` / `bwd_packet_rate`: Packets per second.
5.  `fwd_byte_rate` / `bwd_byte_rate`: Bytes per second.
6.  `mean_iat_fwd` / `std_iat_fwd`: Forward inter-arrival time stats.
7.  `mean_iat_bwd` / `std_iat_bwd`: Backward inter-arrival time stats.
8.  `syn_flag_count` ... `psh_flag_count`: Distribution of TCP control flags.
9.  `mean_packet_length` / `std_packet_length`: Packet size statistics.

## 4. Reliable Publishing (`publisher.py`)

To prevent the packet capture loop from blocking on network latency, the service uses an internal **Background Queue**:
1.  The `FlowEngine` puts completed flows into an `asyncio` queue.
2.  A dedicated `Publisher` worker reads from the queue.
3.  It performs `POST` requests to the Backend's `/ingest` endpoint.
4.  If the backend is temporarily unreachable, the publisher retries, ensuring no telemetry is lost.
