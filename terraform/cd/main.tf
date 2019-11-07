terraform {
  backend "s3" {}
}

provider "aws" {
  version = "2.31.0"
  region  = var.region
}

data "aws_partition" "current" {}
data "aws_caller_identity" "current" {}
