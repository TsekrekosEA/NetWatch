# NetWatch Infrastructure & Observability

NetWatch is designed to be cloud-native, supporting everything from local Docker development to full Kubernetes deployments on AWS.

## 1. Containerization

Each component is containerized with a dedicated `Dockerfile`:
- **Backend**: Python 3.11-slim, optimized for size.
- **Capture**: Python 3.11-slim, requires `privileged: true` or specific capabilities in Docker.
- **Frontend**: Multi-stage build (Build: Node.js 22-alpine -> Serve: Nginx 1.27-alpine).

## 2. Deployment Orchestration

### Docker Compose
Best for development and single-node demos. It launches all 5 services (Backend, Capture, Frontend, Prometheus, Grafana) with a shared internal network.

### Kubernetes & Helm (`infra/helm/`)
For production-grade deployments. The Helm chart supports:
- **Scalability**: Multiple backend replicas (note: requires switching SQLite to a shared DB if scaled horizontally).
- **Security**: Kubernetes Network Policies to restrict traffic between namespaces.
- **Reliability**: Pod Disruption Budgets (PDB) to ensure availability during cluster upgrades.

### Terraform (`infra/terraform/`)
Provides Infrastructure-as-Code (IaC) for AWS:
- **VPC**: Networking isolated for NetWatch.
- **EKS**: Elastic Kubernetes Service cluster.
- **ECR**: Container registries for the three custom images.

## 3. Observability Stack

NetWatch integrates with the industry-standard monitoring stack:

### Prometheus
Scrapes the backend's `/metrics` endpoint every 10 seconds. Key metrics tracked:
- `netwatch_flows_total`: Counter of all processed flows by protocol.
- `netwatch_alerts_total`: Counter of detections by severity and category.
- `netwatch_pipeline_latency_seconds`: Histogram of detection processing time.
- `netwatch_ml_loaded`: Gauge indicating if the ML models are active.

### Grafana
A pre-provisioned Grafana instance is included with a custom dashboard (`netwatch.json`). It provides high-level executive views and technical health metrics, including:
- Flows/sec and Alerts/min.
- Percentile latency (p50, p95, p99).
- Success/Failure rates of the capture-to-backend pipeline.

## 4. Security Hardening

- **Capability Restriction**: The capture service is limited to `NET_ADMIN` and `NET_RAW` rather than full root access where possible.
- **Token Auth**: Communication between the Capture service and Backend is secured by a shared `CAPTURE_TOKEN`.
- **Nginx Proxy**: The frontend container uses Nginx to hide backend implementation details and provide a single entry point.
- **Trivy Scanning**: CI/CD pipelines include Trivy scans to detect vulnerabilities in base images and dependencies.
