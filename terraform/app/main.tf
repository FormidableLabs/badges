data "aws_secretsmanager_secret_version" "fastly_api_token" {
  secret_id = "tf-${var.service_name}-${var.tier}-fastly-api-token"
}

terraform {
  backend "s3" {}
}

provider "aws" {
  version = "2.31.0"
  region  = var.region
}

provider "fastly" {
  version = "0.9.0"
  api_key = data.aws_secretsmanager_secret_version.fastly_api_token.secret_string
}

data "aws_partition" "current" {}
data "aws_caller_identity" "current" {}
