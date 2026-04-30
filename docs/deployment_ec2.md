# Deployment Guide: AWS Free Tier (EC2)

If you want to avoid the costs associated with Managed Kubernetes (EKS), you can deploy NetWatch on a single AWS EC2 instance using **Docker Compose**. This is fully compatible with the AWS Free Tier (using a `t2.micro` or `t3.micro` instance).

## 1. AWS Setup

1.  **Launch an EC2 Instance**:
    - **AMI**: Ubuntu 22.04 LTS (Free Tier eligible).
    - **Instance Type**: `t2.micro` or `t3.micro` (Free Tier eligible).
    - **Key Pair**: Create or use an existing one.
2.  **Configure Security Groups**:
    Inbound rules should allow:
    - `SSH` (22) from your IP.
    - `HTTP` (5174) for the Dashboard.
    - `HTTP` (3000) for Grafana (optional).
    - `HTTP` (8001) for the Backend API (optional, if you want direct access).

---

## 2. Server Preparation

Connect to your instance via SSH:
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

Update and install Docker:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose -y
sudo usermod -aG docker ubuntu
# Log out and back in for group changes to take effect
exit
```

---

## 3. Deploying NetWatch

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/netwatch.git
    cd netwatch
    ```

2.  **Configure environment**:
    ```bash
    cp .env.example .env
    # Edit .env as needed (e.g., set DEMO_MODE=true for testing)
    nano .env
    ```

3.  **Start with Docker Compose**:
    ```bash
    docker-compose up --build -d
    ```

---

## 4. Resource Optimization (Crucial for Free Tier)

Free Tier instances (like `t2.micro`) only have **1GB of RAM**. Running the full stack (Backend, Capture, Frontend, Prometheus, Grafana) can be tight.

### Recommendations for 1GB Instances:
- **Enable Swap**: This prevents the instance from crashing if it runs out of RAM.
  ```bash
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```
- **Disable Unused Services**: If you don't need the observability stack, comment out `prometheus` and `grafana` in `docker-compose.yml`.
- **Lower Log Retention**: Ensure `docker-compose.yml` has logging limits to prevent disk fill-up.

---

## 5. Accessing the dashboard

Open your browser and navigate to:
`http://your-ec2-public-ip:5174`

---

## 6. Comparison: EC2 vs. EKS

| Feature | EC2 (Single Instance) | EKS (Managed Kubernetes) |
|---|---|---|
| **Cost** | **Free** (within Tier) | ~$73/month (Cluster fee alone) |
| **Setup** | Simple (Docker Compose) | Complex (Terraform/Helm) |
| **Scalability** | Manual | Automatic |
| **Maintenance** | High (OS updates) | Low (Managed) |
