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
│                 │         │  │  Stage 1: Statistical Baseline        │  │
│  Flow Engine    │         │  │  (z-score rolling window)             │  │
│  (5-tuple →     │         │  │            │                          │  │
│   20-dim vector)│         │  │  Stage 2: ML Classifier               │  │
└─────────────────┘         │  │  (Isolation Forest + Random Forest)   │  │
                            │  └───────────┬───────────────────────────┘  │
                            │              │                              │
                            │     ┌────────▼────────┐   ┌────────────┐   │
                            │     │  SQLite (WAL)   │   │ WebSocket  │   │
                            │     │  Alert Store    │   │ Broadcast  │   │
                            │     └─────────────────┘   └─────┬──────┘   │
                            └─────────────────────────────────┼──────────┘
                                                              │
                            ┌─────────────────────────────────▼──────────┐
                            │  Frontend (React + TypeScript)             │
                            │                                            │
                            │  Live Alert Feed  │  Traffic Charts        │
                            │  Stats Overview   │  Threat Heatmap        │
                            │  Protocol Breakdown │ Category Analysis    │
                            └────────────────────────────────────────────┘
```

## How It Works

### Stage 1 — Statistical Baseline Detection

Each incoming network flow is represented as a 20-dimensional feature vector (byte counts, packet rates, inter-arrival times, TCP flag distributions). A rolling window of the last 1,000 flows maintains per-feature mean and standard deviation. Any flow with features deviating more than 3.5 standard deviations from the baseline is flagged. This catches volume-based attacks (port scans, SYN floods, DoS) immediately with zero training data.

### Stage 2 — ML Classifier

Two models trained on the CIC-IDS-2018 dataset:

- **Isolation Forest** (unsupervised): Trained on benign traffic only. Models how easily a point can be isolated from the cluster of normal behaviour — anomalies are easy to isolate.
- **Random Forest** (supervised): Trained on all 14 labelled attack categories. Provides specific attack classification for known signatures.

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

## Training the ML Models

The ML stage is optional — the system works with statistical detection alone. To enable ML classification:

```bash
# 1. Download CIC-IDS-2018 (see data/README.md for instructions)
#    Place CSV files in the data/ directory

# 2. Train models
cd backend
pip install -r requirements.txt
python -m ml.train

# 3. Evaluate
python -m ml.evaluate

# 4. Models are saved to backend/ml/models/ and loaded automatically on startup
```

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

## Project Structure

```
netwatch/
├── docker-compose.yml           # Orchestrates all services
├── .env.example                 # Environment configuration template
├── capture/                     # Packet capture + flow engine
│   ├── main.py                  # Entrypoint (live or demo mode)
│   ├── capture.py               # Scapy live packet sniffer
│   ├── flow_engine.py           # 5-tuple flow assembly + feature tracking
│   ├── features.py              # 20-dimension feature extraction
│   ├── publisher.py             # HTTP POST to backend ingest
│   └── demo_traffic.py          # Synthetic traffic + attack patterns
├── backend/                     # FastAPI backend
│   ├── main.py                  # App entrypoint
│   ├── config.py                # Settings from env vars
│   ├── database.py              # SQLite async with WAL mode
│   ├── models/alert.py          # DB operations for alerts
│   ├── schemas/                 # Pydantic schemas (flow, alert)
│   ├── routers/                 # REST + WebSocket endpoints
│   ├── detection/               # Two-stage detection pipeline
│   │   ├── pipeline.py          # Orchestrator
│   │   ├── stage1_statistical.py # Z-score rolling baseline
│   │   ├── stage2_ml.py         # IF + RF classifier wrapper
│   │   └── severity.py          # Severity scoring logic
│   └── ml/                      # Offline training scripts
│       ├── train.py             # Train on CIC-IDS-2018
│       ├── evaluate.py          # Compute metrics
│       └── preprocess.py        # Dataset column alignment
├── frontend/                    # React + TypeScript dashboard
│   └── src/
│       ├── hooks/               # WebSocket + polling hooks
│       ├── pages/Dashboard.tsx  # Main dashboard layout
│       └── components/          # Alert feed, charts, heatmap
└── data/                        # CIC-IDS-2018 CSV files (gitignored)
```

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/ingest` | Receive flow from capture service |
| GET | `/alerts` | Paginated alert history |
| GET | `/alerts/recent` | Last N alerts |
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
