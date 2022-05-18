variable "region" {
  description = "The deploy target region in AWS"
}

variable "service_name" {
  description = "Name of service / application"
}

variable "tier" {
  description = "The support tier to deploy to. Either `nonprod` or `prod`. Emulates account separation."
}

variable "stage" {
  description = "The stage/environment to deploy to. Suggest: `sandbox`, `development`, `staging`, `production`. Can be dynamic."
}

variable "root_domain_name" {
  description = "The root domain name to attach a custom subdomain to for API Gateway."
}

variable "root_domain_name_zone_id" {
  description = "The Route53 zone ID for root_domain_name."
}

variable "root_domain_name_wildcard_certificate_arn" {
  description = "The ARN of a wildcard ACM certificate for root_domain_name."
}

variable "fastly_cname_domain" {
  description = "The Fastly domain to point to root domain CNAME to."
}

locals {
  prefix = "tf-${var.service_name}-${var.tier}-${var.stage}"

  # We map tier to stage for normalization against `terraform-aws-serverless`.
  tags = map(
    "Service", var.service_name,
    "Tier", var.tier,
    "Stage", var.tier,
    "TierStage", var.stage,
  )

  account_id = data.aws_caller_identity.current.account_id
  parition   = data.aws_partition.current.partition
}
