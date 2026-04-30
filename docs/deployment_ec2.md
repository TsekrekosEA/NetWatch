# Single-Node EC2 Deployment (AWS Free Tier)

This guide provides step-by-step instructions for deploying NetWatch on a single AWS EC2 instance using Docker Compose. This is the most cost-effective way to run the project, fitting entirely within the AWS Free Tier.

## 1. Prerequisites

- An AWS account.
- Basic familiarity with the AWS Console and SSH.

## 2. Infrastructure Setup

### Instance Selection
To stay within the Free Tier:
- **Region**: Choose a region where the Free Tier is available (e.g., `us-east-1`).
- **AMI**: Amazon Linux 2023 or Ubuntu 24.04 LTS (Free Tier eligible).
- **Instance Type**: `t2.micro` (or `t3.micro` in regions where it's the Free Tier default).

### Security Group Configuration
Create a security group with the following inbound rules:

| Protocol | Port | Source | Description |
|---|---|---|---|
| TCP | 22 | Your IP | SSH Access |
| TCP | 5174 | Custom/Anywhere | NetWatch Frontend |
| TCP | 8001 | Custom/Anywhere | NetWatch Backend API |
| TCP | 3000 | Custom/Anywhere | Grafana Dashboard |
| TCP | 9090 | Custom/Anywhere | Prometheus (Optional) |

*Note: In a production environment, you should restrict access to your IP and consider using a reverse proxy on port 80/443.*

## 3. Instance Preparation

SSH into your instance:
```bash
ssh -i your-key.pem ec2-user@your-instance-ip
```

### Install Docker and Docker Compose
```bash
# Update packages
sudo dnf update -y  # For Amazon Linux 2023
# sudo apt update && sudo apt upgrade -y # For Ubuntu

# Install Docker
sudo dnf install -y docker # For Amazon Linux 2023
# sudo apt install -y docker.io # For Ubuntu

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Log out and log back in for group changes to take effect
exit
```

Reconnect and install Docker Compose:
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Enable Swap (Crucial for t2.micro/t3.micro)
Free Tier instances only have 1GB of RAM. NetWatch (especially the ML models and Grafana) may exceed this. Adding a 2GB swap file ensures stability.

```bash
sudo dd if=/dev/zero of=/swapfile bs=128M count=16
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

## 4. Deploying NetWatch

### Clone the Repository
```bash
git clone https://github.com/your-username/netwatch.git
cd netwatch
```

### Configure Environment
```bash
cp .env.example .env
# Edit .env if needed (e.g., set DEMO_MODE=true for initial testing)
# nano .env
```

### Launch Services
```bash
docker-compose up -d --build
```

## 5. Accessing the Application

- **Frontend**: `http://your-instance-ip:5174`
- **Grafana**: `http://your-instance-ip:3000` (Default: admin / netwatch)
- **API Health**: `http://your-instance-ip:8001/health`

## 6. Troubleshooting

- **Out of Memory**: If containers crash, check `dmesg` for OOM kills. Ensure the swap file is active (`swapon --show`).
- **Capture Issues**: Ensure the capture container has `NET_ADMIN` and `NET_RAW` capabilities (included in the default `docker-compose.yml`).
- **Connection Refused**: Verify Security Group rules in the AWS Console.
