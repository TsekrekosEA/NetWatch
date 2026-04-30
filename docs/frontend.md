# NetWatch Frontend Documentation

The NetWatch frontend is a modern, responsive React dashboard built with TypeScript and Vite. It provides real-time visualization of network health and security incidents.

## 1. Technology Stack

- **Framework**: React 19 + TypeScript.
- **Build Tool**: Vite.
- **Styling**: Tailwind CSS (for layout) + Radix UI (for primitives).
- **Charts**: Recharts (optimized for real-time timeseries).
- **Icons**: Lucide React.
- **Data Fetching**: Axios + Custom WebSocket hooks.

## 2. Real-Time Architecture

The dashboard relies on a "Push-Pull" model:

- **Push (WebSockets)**:
    - The `useAlertStream` hook maintains a persistent connection to `/ws/alerts`.
    - It receives `alert` messages and prepends them to the live feed.
    - It receives `stats_update` messages to update the summary counters instantly.
    - **Reliability**: Includes automatic reconnection logic with exponential backoff.

- **Pull (Polling)**:
    - The `useStats` hook polls `/stats/summary` and `/stats/timeline` on a 10-second interval.
    - This ensures that charts stay in sync even if the user just joined or if a WebSocket message was missed.

## 3. Core Components

### Dashboard Layout
The main entry point (`Dashboard.tsx`) manages the state of filters (severity, IP) and the forensic modal.

### Alert Feed (`AlertFeed.tsx`)
- Displays a scrollable list of recent alerts.
- Highlights severity using color-coded badges (e.g., pulsing red for `CRITICAL`).
- Supports one-click expansion to view flow metadata.

### Forensic Modal (`AlertDetailModal.tsx`)
Triggered when an alert is selected, this component provides:
- **Flow Details**: IPs, ports, protocols, and exact timing.
- **Detection Logic**: Shows Z-scores for Stage 1 or ML scores/confidence for Stage 2.
- **Threat Intel**: Real-time GeoIP and ASN data for the source IP.
- **Pivot Search**: Allows the user to quickly filter the dashboard for all alerts related to that specific IP.

### Visualization Widgets
- **TrafficChart**: A multi-series area chart showing flows and alerts over time.
- **ProtocolBreakdown**: A donut chart showing the distribution of TCP, UDP, and ICMP traffic.
- **ThreatHeatmap**: A bar chart categorizing detections (e.g., DoS, Port Scan, Brute Force).

## 4. Development & Production

### Dev Environment
The `vite.config.ts` handles HMR (Hot Module Replacement) and reads from `VITE_API_URL` / `VITE_WS_URL`.

### Production Deployment
In production, the frontend is served by **Nginx**.
- The React app is built into static assets.
- Nginx acts as a **Reverse Proxy**, routing `/api/` and `/ws/` requests to the internal backend service. This avoids CORS issues and simplifies the networking stack.
