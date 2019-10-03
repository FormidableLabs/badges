provider "aws" {
  version = "2.31.0"
  region  = var.region
}

terraform {
  backend "s3" {}
}

data "aws_partition" "current" {}
data "aws_caller_identity" "current" {}
