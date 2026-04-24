project_name       = "netwatch"
environment        = "dev"
aws_region         = "eu-central-1"
kubernetes_version = "1.30"

node_instance_types = ["t3.medium"]
node_desired_size   = 2
node_min_size       = 1
node_max_size       = 3

backend_image_tag  = "latest"
capture_image_tag  = "latest"
frontend_image_tag = "latest"

enable_helm_release = true
