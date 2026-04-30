# NetWatch Backend Documentation

The NetWatch backend is a FastAPI-driven service that orchestrates the detection pipeline, manages alert persistence, and provides a real-time data API for the frontend and monitoring stacks.

## 1. Core Responsibilities

- **Ingestion**: Receives bidirectional flow records from the capture service via `POST /ingest`.
- **Detection**: Runs the two-stage (Statistical + ML) pipeline.
- **Persistence**: Stores alerts and flow statistics in SQLite.
- **Streaming**: Broadcasts live alerts via WebSockets.
- **Enrichment**: Performs GeoIP and AbuseIPDB lookups for forensic analysis.
- **Observability**: Exposes Prometheus metrics and provides health status.

## 2. Detection Pipeline (`detection/`)

The `run_pipeline` function in `pipeline.py` is the central orchestrator:

1.  **Stage 1: Statistical Baseline** (`stage1_statistical.py`):
    - Maintains a rolling window (default 1,000 flows) of feature values.
    - Calculates Z-scores for every feature in an incoming flow.
    - Flags flows where features exceed `STAT_THRESHOLD` (default 3.5σ).
    - Classifies attacks based on specific feature combinations (e.g., high `syn_flag_count` + short `duration` = Port Scan).

2.  **Stage 2: Machine Learning** (`stage2_ml.py`):
    - **Isolation Forest (IF)**: Unsupervised model that identifies "outliers" based on how easily they can be isolated in feature space.
    - **Random Forest (RF)**: Supervised model trained on the CIC-IDS-2018 dataset for multi-class attack classification.
    - **Confidence Gating**: RF predictions are only trusted if the probability exceeds `RF_CONFIDENCE_THRESHOLD`. If low-confidence, the system falls back to IF or Stage 1.

3.  **Combination Logic** (`severity.py`):
    - Merges results from both stages.
    - High-confidence ML classifications take precedence.
    - If both stages agree on an anomaly, severity is escalated (e.g., to `CRITICAL` or `HIGH`).

4.  **Alert Rate Limiting**:
    - Prevents "alert storms" by suppressing duplicate alerts for the same `(src_ip, category)` pair within a 10-second window.

## 3. API Reference

### Flow Ingestion
- `POST /ingest`: Secured by `X-Capture-Token`. Accepts `FlowRecord` and returns an `IngestResponse`.

### Alerts & History
- `GET /alerts`: Paginated history with filters for severity, category, IP, and time range.
- `GET /alerts/recent`: Returns the last 20 alerts (optimized for dashboard initialization).
- `GET /alerts/export`: Streams alert history as a CSV file.

### Real-Time Streaming
- `WS /ws/alerts`: WebSocket endpoint for live JSON push. Sends both `alert` and `stats_update` message types.

### Threat Intelligence
- `GET /threats/intel/{ip}`: Real-time GeoIP (ip-api.com) and AbuseIPDB enrichment. Results are cached for 1 hour.

### Performance & Stats
- `GET /stats/summary`: 1-hour summary of flows, alerts, protocol distribution, and top IPs.
- `GET /stats/timeline`: Bucketed timeline data for charts.
- `GET /health`: Basic health, uptime, and ML status.
- `GET /metrics`: Standard Prometheus metrics.

## 4. Database Schema

The system uses two primary tables in `netwatch.db`:

- **`alerts`**: Stores detailed forensic data for every detection, including the full JSON `details` of why an anomaly was flagged.
- **`flow_stats`**: A high-frequency log of traffic volume (protocol, bytes, packets) used to generate the dashboard charts.

Indices are maintained on `timestamp`, `severity`, and `src_ip` to ensure fast querying even as the database grows.
