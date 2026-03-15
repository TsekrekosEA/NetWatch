# NetWatch — Network Anomaly Detection & Intrusion Detection System

A two-stage network intrusion detection system combining statistical baselining with an ML anomaly scorer, built on real packet capture with a live WebSocket dashboard — targeting the same problem space as production telecom security infrastructure.

## Architecture

```
┌─────────────────┐         ┌─────────────────────────────────────────────┐
│  Capture        │  HTTP   │  Backend (FastAPI)                          │
│  Service        │ POST    │                                             │
│                 ├────────►│  ┌───────────────────────────────────────┐  │
│  Scapy/libpcap  │         │  │  Detection Pipeline                  │  │
│  or Demo Mode   │         │  │                                       │  │
│  or PCAP Replay │         │  │  Stage 1: Statistical Baseline        │  │
│                 │         │  │  (z-score rolling window)             │  │
│  Flow Engine    │         │  │            │                          │  │
│  (5-tuple →     │         │  │  Stage 2: ML Classifier               │  │
│   20-dim vector)│         │  │  (Isolation Forest + Random Forest)   │  │
└─────────────────┘         │  └───────────┬───────────────────────────┘  │
                            │              │                              │
  Async publisher           │     ┌────────▼────────┐   ┌────────────┐   │
  (background queue,        │     │  SQLite (WAL)   │   │ WebSocket  │   │
   never blocks the         │     │  Alert Store    │   │ Broadcast  │   │
   flow engine lock)        │     └─────────────────┘   └─────┬──────┘   │
                            │                                  │          │
                            │  Alert rate limiter (per-IP      │          │
                            │  dedup within configurable       │          │
                            │  time window)                    │          │
                            └──────────────────────────────────┼──────────┘
                                                               │
                            ┌──────────────────────────────────▼──────────┐
                            │  Frontend (React + TypeScript)              │
                            │                                             │
                            │  Live Alert Feed    │  Traffic Charts       │
                            │  (severity filter,  │  (area + gradient)    │
                            │   IP search, CSV    │                       │
                            │   export)           │  Threat Heatmap       │
                            │                     │                       │
                            │  Alert Detail Modal │  Protocol Breakdown   │
                            │  (forensics, related│  Stats + Sparklines   │
                            │   alerts, ML data)  │                       │
                            └─────────────────────────────────────────────┘
```

## How It Works

### Stage 1 — Statistical Baseline Detection

Each incoming network flow is represented as a 20-dimensional feature vector (byte counts, packet rates, inter-arrival times, TCP flag distributions). A rolling window of the last 1,000 flows maintains per-feature mean and standard deviation. Any flow with features deviating more than 3.5 standard deviations from the baseline is flagged. This catches volume-based attacks (port scans, SYN floods, DoS) immediately with zero training data.

### Stage 2 — ML Classifier

Two models trained on the CIC-IDS-2018 dataset:

- **Isolation Forest** (unsupervised): Trained on benign traffic only. Models how easily a point can be isolated from the cluster of normal behaviour — anomalies are easy to isolate.
- **Random Forest** (supervised): Trained on all 14 labelled attack categories. Provides specific attack classification for known signatures. Low-confidence predictions (below `RF_CONFIDENCE_THRESHOLD`) are suppressed to reduce false positives.

The two stages are complementary: Stage 1 catches volume anomalies instantly; Stage 2 catches pattern-based attacks that look normal by volume (slow scans, brute force, C2 beaconing).

### Connection to Vector-Distance / ANN Concepts

The ML stage uses the same vector-distance intuition as approximate nearest neighbour search. Flow feature vectors are points in 20-dimensional space. The Isolation Forest explicitly measures how far a point is from the learned cluster of normal behaviour — conceptually identical to finding the nearest neighbours in a vector database and flagging points that are distant from any known cluster.

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Packet capture | Scapy + libpcap | Scriptable, cross-platform |
| Flow engine | Python + NumPy | Full control over feature extraction |
| Stage 1 | Statistical (z-score) | Fast, explainable, no training needed |
| Stage 2 | scikit-learn (IF + RF) | Standard, well-understood, exportable |
| Dataset | CIC-IDS-2018 | Academic standard for IDS research |
| Alert store | SQLite (WAL mode) | Zero-dependency, portable, fast writes |
| Backend | FastAPI | Async, WebSocket-native |
| Real-time push | WebSocket | Low-latency alert streaming |
| Frontend | React + TypeScript + Vite | Live dashboard with Recharts |
| Containers | Docker + docker-compose | One command to run everything |
| Tests | pytest + pytest-asyncio | 50 tests covering pipeline, models, API |

## Quick Start — Demo Mode

```bash
# 1. Clone and configure
cp .env.example .env

# 2. Start all services
docker compose up --build

# 3. Open the dashboard
open http://localhost:5174
```

The demo mode generates synthetic benign traffic (~50 flows/min) with periodic injected attacks (port scans, SYN floods, SSH brute force, DNS floods) — no root privileges or live network needed.

## Quick Start — Live Capture Mode

```bash
# 1. Configure for live capture
cp .env.example .env
# Edit .env: set DEMO_MODE=false, INTERFACE=<your_interface>

# 2. Start (requires root/NET_ADMIN for packet capture)
docker compose up --build

# 3. Open the dashboard
open http://localhost:5174
```

## Quick Start — PCAP Replay Mode

Replay recorded `.pcap` / `.pcapng` files through the full detection pipeline:

```bash
# 1. Configure
cp .env.example .env
# Edit .env:
#   DEMO_MODE=false
#   REPLAY_PCAP=/data/your-capture.pcap
#   REPLAY_SPEED=10.0   (10x real-time speed)
#   REPLAY_LOOP=true     (loop for continuous demo)

# 2. Mount your PCAP file into the capture container (docker-compose.yml)
# volumes:
#   - ./your-capture.pcap:/data/your-capture.pcap

# 3. Start
docker compose up --build
```

## Training the ML Models

The ML stage is optional — the system works with statistical detection alone. To enable ML classification:

```bash
# 1. Download CIC-IDS-2018 (see data/README.md for instructions)
#    Place CSV files in the data/ directory

# 2. Train models
cd backend
pip install -r requirements.txt
python3 -m ml.train

# 3. Evaluate
python3 -m ml.evaluate

# 4. Models are saved to backend/ml/models/ and loaded automatically on startup
```

## Running Tests

```bash
cd backend
pip install pytest pytest-asyncio
python3 -m pytest tests/ -v
```

The test suite covers:
- **test_stage1.py** — Rolling baseline z-score detection, warmup behaviour, severity thresholds, anomaly classification
- **test_stage2.py** — ML classifier loading, prediction, confidence gating, class-severity mapping
- **test_severity.py** — Severity combination logic, stage merging, Unknown Anomaly fallback
- **test_pipeline.py** — Alert rate limiting / deduplication
- **test_models.py** — Database insert/query, pagination, filtering (severity, category, IP)
- **test_api.py** — REST endpoint responses, auth token enforcement, CSV export, stats

## Performance Metrics

Trained on **4,089,895 flows** from the CIC-IDS-2018 dataset (80/20 train/test split):

### Random Forest (supervised multi-class)

| Metric | Value |
|---|---|
| Overall accuracy | **90.91%** |
| Weighted F1 score | **0.91** |
| Benign false positive rate | **3.21%** |

Per-class breakdown:

| Class | Precision | Recall | F1 |
|---|---|---|---|
| Benign | 1.00 | 0.97 | 0.98 |
| DDoS | 0.72 | 0.94 | 0.82 |
| DoS | 0.78 | 0.63 | 0.69 |

### Isolation Forest (unsupervised anomaly detection)

| Metric | Value |
|---|---|
| False positive rate | **0.96%** |
| Detection rate | 0.19% (expected — trained only on benign baseline) |

## Environment Variables

### Backend

| Variable | Default | Description |
|---|---|---|
| `CAPTURE_TOKEN` | `change-me-in-production` | Shared auth token between capture and backend |
| `ML_MODELS_PATH` | `./ml/models` | Path to trained model files |
| `LOG_LEVEL` | `INFO` | Logging verbosity |
| `STAT_THRESHOLD` | `3.5` | Z-score threshold for statistical anomaly |
| `ROLLING_WINDOW_SIZE` | `1000` | Number of flows in the rolling baseline window |
| `STAT_WARMUP` | `30` | Minimum samples before statistical detection activates |
| `SEVERITY_MEDIUM_THRESHOLD` | `3` | Number of anomalous features for MEDIUM severity |
| `SEVERITY_HIGH_THRESHOLD` | `6` | Number of anomalous features for HIGH severity |
| `IF_THRESHOLD` | `-0.2` | Isolation Forest anomaly score cutoff |
| `RF_CONFIDENCE_THRESHOLD` | `0.4` | Minimum RF probability to trust classification |
| `ALERT_RATE_LIMIT_SECONDS` | `10` | Suppress duplicate alerts per (src_ip + category) within this window |

### Capture Service

| Variable | Default | Description |
|---|---|---|
| `DEMO_MODE` | `true` | Enable synthetic traffic generation |
| `REPLAY_PCAP` | _(empty)_ | Path to PCAP file for replay mode (overrides demo) |
| `REPLAY_SPEED` | `10.0` | Replay speed multiplier (10 = 10x real-time) |
| `REPLAY_LOOP` | `false` | Loop the PCAP file for continuous demo |
| `INTERFACE` | `eth0` | Network interface for live capture |
| `BPF_FILTER` | `ip` | BPF filter expression for packet capture |
| `FLOW_TIMEOUT` | `120` | Seconds before an idle flow is expired |
| `MAX_FLOW_PACKETS` | `10000` | Max packets per flow before forced emission |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend REST API base URL |
| `VITE_WS_URL` | `ws://localhost:8000` | Backend WebSocket base URL |

## Project Structure

```
netwatch/
├── docker-compose.yml           # Orchestrates all services
├── .env.example                 # Environment configuration template
├── capture/                     # Packet capture + flow engine
│   ├── main.py                  # Entrypoint (demo / live / pcap replay)
│   ├── capture.py               # Scapy live packet sniffer (w/ BPF filter)
│   ├── flow_engine.py           # 5-tuple flow assembly + bounded flow table
│   ├── features.py              # 20-dimension feature extraction
│   ├── publisher.py             # Async HTTP publisher (background queue)
│   ├── demo_traffic.py          # Synthetic traffic + attack patterns
│   └── pcap_replay.py           # PCAP file replay mode
├── backend/                     # FastAPI backend
│   ├── main.py                  # App entrypoint
│   ├── config.py                # All settings from env vars
│   ├── database.py              # SQLite async with WAL mode
│   ├── models/alert.py          # DB operations for alerts + flow stats
│   ├── schemas/                 # Pydantic schemas (flow, alert)
│   ├── routers/
│   │   ├── ingest.py            # Flow ingestion endpoint
│   │   ├── alerts.py            # Alert listing, filtering, CSV export
│   │   └── ws.py                # WebSocket live alert streaming
│   ├── detection/               # Two-stage detection pipeline
│   │   ├── pipeline.py          # Orchestrator + rate limiter
│   │   ├── stage1_statistical.py # Z-score rolling baseline
│   │   ├── stage2_ml.py         # IF + RF classifier (w/ confidence gating)
│   │   └── severity.py          # Severity scoring + stage combination
│   ├── ml/                      # Offline training scripts
│   │   ├── train.py             # Train on CIC-IDS-2018
│   │   ├── evaluate.py          # Compute metrics
│   │   └── preprocess.py        # Dataset column alignment + label simplification
│   └── tests/                   # pytest test suite (50 tests)
│       ├── conftest.py          # Fixtures (test DB, sample data)
│       ├── test_stage1.py       # Statistical baseline tests
│       ├── test_stage2.py       # ML classifier tests
│       ├── test_severity.py     # Severity combination tests
│       ├── test_pipeline.py     # Rate limiter tests
│       ├── test_models.py       # DB model tests
│       └── test_api.py          # API endpoint tests
├── frontend/                    # React + TypeScript dashboard
│   └── src/
│       ├── hooks/               # WebSocket + polling hooks
│       ├── pages/Dashboard.tsx  # Main dashboard layout
│       └── components/
│           ├── AlertFeed.tsx     # Live alert list with animations
│           ├── AlertToolbar.tsx  # Severity filter, IP search, export
│           ├── AlertDetailModal.tsx # Full forensic drill-down modal
│           ├── StatsBar.tsx      # Summary cards + sparklines
│           ├── TrafficChart.tsx  # Area chart with gradient fills
│           ├── ProtocolBreakdown.tsx # Protocol pie chart
│           ├── ThreatHeatmap.tsx # Attack category bar chart
│           ├── SeverityBadge.tsx # CRITICAL pulsing badge
│           ├── CriticalAlertToast.tsx # Toast notifications
│           ├── ErrorBoundary.tsx # React error boundary
│           └── Skeleton.tsx     # Loading skeleton components
└── data/                        # CIC-IDS-2018 CSV files (gitignored)
```

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/ingest` | Receive flow from capture service |
| GET | `/alerts` | Paginated alert history (filters: `severity`, `category`, `src_ip`, `since`, `until`) |
| GET | `/alerts/recent` | Last N alerts |
| GET | `/alerts/export` | CSV export with optional filters |
| GET | `/stats/summary` | Dashboard summary statistics |
| GET | `/stats/timeline` | Per-minute bucketed timeline |
| WS | `/ws/alerts` | Live alert + stats streaming |
| GET | `/health` | Service health check |

## The 20-Dimensional Feature Vector

Each network flow is represented as a fixed-length numerical vector:

| # | Feature | Description |
|---|---|---|
| 1 | duration | Flow duration (seconds) |
| 2 | total_fwd_packets | Forward packet count |
| 3 | total_bwd_packets | Backward packet count |
| 4 | total_fwd_bytes | Forward byte count |
| 5 | total_bwd_bytes | Backward byte count |
| 6 | fwd_packet_rate | Forward packets/second |
| 7 | bwd_packet_rate | Backward packets/second |
| 8 | fwd_byte_rate | Forward bytes/second |
| 9 | bwd_byte_rate | Backward bytes/second |
| 10 | mean_iat_fwd | Mean inter-arrival time (forward) |
| 11 | std_iat_fwd | Std inter-arrival time (forward) |
| 12 | mean_iat_bwd | Mean inter-arrival time (backward) |
| 13 | std_iat_bwd | Std inter-arrival time (backward) |
| 14 | syn_flag_count | TCP SYN flags |
| 15 | ack_flag_count | TCP ACK flags |
| 16 | fin_flag_count | TCP FIN flags |
| 17 | rst_flag_count | TCP RST flags |
| 18 | psh_flag_count | TCP PSH flags |
| 19 | mean_packet_length | Mean packet size (bytes) |
| 20 | std_packet_length | Std of packet sizes |

## License

MIT
