project_name       = "netwatch"
environment        = "staging"
aws_region         = "eu-central-1"
kubernetes_version = "1.30"

node_instance_types = ["t3.large"]
node_desired_size   = 2
node_min_size       = 2
node_max_size       = 5

backend_image_tag  = "latest"
capture_image_tag  = "latest"
frontend_image_tag = "latest"

enable_helm_release = true
