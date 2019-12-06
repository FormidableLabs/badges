provider "aws" {
  version = "2.31.0"
  region  = var.region
}

terraform {
  backend "s3" {}
}

data "aws_partition" "current" {}
data "aws_caller_identity" "current" {}

# A resource group is an optional, but very nice thing to have, especially
# when managing resources across CF + TF + SLS.
#
# This RG aggregates all of CF + TF + SLS together by `Service` + `Tier`
# (as `Stage`) to support `terraform-aws-serverless` + serverless mappings.
resource "aws_resourcegroups_group" "resources_tier" {
  name = "tf-${var.service_name}-${var.tier}"

  resource_query {
    query = <<JSON
{
  "ResourceTypeFilters": [
    "AWS::AllSupported"
  ],
  "TagFilters": [
    {
      "Key": "Service",
      "Values": ["${var.service_name}"]
    },
    {
      "Key": "Stage",
      "Values": ["${var.tier}"]
    }
  ]
}
JSON
  }
}
