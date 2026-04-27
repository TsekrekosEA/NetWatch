locals {
  name = "${var.project_name}-${var.environment}"
  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"

  name = local.name
  cidr = var.vpc_cidr

  azs                = slice(data.aws_availability_zones.available.names, 0, 3)
  private_subnets    = ["10.42.1.0/24", "10.42.2.0/24", "10.42.3.0/24"]
  public_subnets     = ["10.42.101.0/24", "10.42.102.0/24", "10.42.103.0/24"]
  enable_nat_gateway = true
  single_nat_gateway = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
  }

  tags = local.tags
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.8"

  cluster_name    = local.name
  cluster_version = var.kubernetes_version

  cluster_endpoint_public_access = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    default = {
      desired_size   = var.node_desired_size
      min_size       = var.node_min_size
      max_size       = var.node_max_size
      instance_types = var.node_instance_types
      labels = {
        workload = "general"
      }
    }
  }

  enable_cluster_creator_admin_permissions = true

  tags = local.tags
}

data "aws_eks_cluster_auth" "this" {
  name = module.eks.cluster_name
}

resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}/backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}

resource "aws_ecr_repository" "capture" {
  name                 = "${var.project_name}/capture"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}

resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project_name}/frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}

resource "kubernetes_namespace" "netwatch" {
  metadata {
    name = "netwatch"
    labels = {
      app = "netwatch"
    }
  }

  depends_on = [module.eks]
}

resource "helm_release" "netwatch" {
  count = var.enable_helm_release ? 1 : 0

  name      = "netwatch"
  namespace = kubernetes_namespace.netwatch.metadata[0].name
  chart     = var.helm_chart_path
  timeout   = 600
  atomic    = true
  wait      = true

  set {
    name  = "global.image.registry"
    value = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
  }

  set {
    name  = "backend.image.repository"
    value = aws_ecr_repository.backend.name
  }

  set {
    name  = "backend.image.tag"
    value = var.backend_image_tag
  }

  set {
    name  = "capture.image.repository"
    value = aws_ecr_repository.capture.name
  }

  set {
    name  = "capture.image.tag"
    value = var.capture_image_tag
  }

  set {
    name  = "frontend.image.repository"
    value = aws_ecr_repository.frontend.name
  }

  set {
    name  = "frontend.image.tag"
    value = var.frontend_image_tag
  }

  depends_on = [kubernetes_namespace.netwatch]
}
