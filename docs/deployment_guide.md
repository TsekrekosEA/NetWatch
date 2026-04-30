# Deployment Guide: AWS & Kubernetes (EKS)

This guide provides step-by-step instructions for deploying NetWatch to a production-ready environment on AWS using Amazon EKS (Elastic Kubernetes Service) and Terraform.

## 1. Prerequisites

Before starting, ensure you have the following tools installed and configured:

- **AWS CLI**: [Installed](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and configured with `aws configure`.
- **Terraform** (>= 1.7): [Installed](https://developer.hashicorp.com/terraform/downloads).
- **kubectl**: [Installed](https://kubernetes.io/docs/tasks/tools/).
- **Helm** (>= 3): [Installed](https://helm.sh/docs/intro/install/).
- **Docker**: For building and pushing images.

---

## 2. Infrastructure Provisioning (Terraform)

NetWatch uses Terraform to provision the underlying AWS infrastructure.

1.  **Navigate to the Terraform directory**:
    ```bash
    cd infra/terraform
    ```

2.  **Initialize Terraform**:
    ```bash
    terraform init
    ```

3.  **Plan the deployment**:
    Review the changes Terraform will make. Use the `dev.tfvars` or create your own.
    ```bash
    terraform plan -var-file=environments/dev.tfvars
    ```

4.  **Apply the changes**:
    This will create the VPC, EKS Cluster, and ECR repositories.
    ```bash
    terraform apply -var-file=environments/dev.tfvars
    ```
    *Note: This process typically takes 15–20 minutes.*

5.  **Update Kubeconfig**:
    After the cluster is created, configure `kubectl` to connect to it:
    ```bash
    aws eks update-kubeconfig --region <your-region> --name netwatch-dev
    ```

---

## 3. Container Images (ECR)

Once the ECR repositories are created by Terraform, you need to push the NetWatch images.

1.  **Authenticate Docker to ECR**:
    ```bash
    aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com
    ```

2.  **Build, Tag, and Push**:
    Run these commands for each service (backend, capture, frontend):

    **Backend**:
    ```bash
    docker build -t netwatch/backend ./backend
    docker tag netwatch/backend:latest <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com/netwatch/backend:latest
    docker push <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com/netwatch/backend:latest
    ```

    **Capture**:
    ```bash
    docker build -t netwatch/capture ./capture
    docker tag netwatch/capture:latest <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com/netwatch/capture:latest
    docker push <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com/netwatch/capture:latest
    ```

    **Frontend**:
    ```bash
    docker build -t netwatch/frontend ./frontend
    docker tag netwatch/frontend:latest <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com/netwatch/frontend:latest
    docker push <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com/netwatch/frontend:latest
    ```

---

## 4. Application Deployment (Helm)

If you didn't enable `enable_helm_release` in Terraform, or if you want to update the app manually:

1.  **Navigate to the Helm chart**:
    ```bash
    cd infra/helm/netwatch
    ```

2.  **Install/Upgrade the release**:
    ```bash
    helm upgrade --install netwatch . \
      --namespace netwatch \
      --create-namespace \
      --set global.image.registry=<aws_account_id>.dkr.ecr.<your-region>.amazonaws.com
    ```

---

## 5. Post-Deployment

### Accessing the Dashboard
By default, the frontend is exposed via a LoadBalancer. Get the address:
```bash
kubectl get service netwatch-frontend -n netwatch
```
Look for the `EXTERNAL-IP`. It may take a few minutes for the DNS to propagate.

### Monitoring
If you wish to deploy the observability stack (Prometheus/Grafana) to K8s:
1.  Ensure the Prometheus scrape targets are updated to point to the K8s service names.
2.  Use the community Helm charts for Prometheus and Grafana.

---

## 6. Cleanup

To avoid ongoing AWS costs, destroy the resources when finished:

```bash
cd infra/terraform
terraform destroy -var-file=environments/dev.tfvars
```
