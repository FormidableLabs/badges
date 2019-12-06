variable "region" {
  description = "The deploy target region in AWS"
}

variable "service_name" {
  description = "Name of service / application"
}

variable "tier" {
  description = "The support tier to deploy to. Either `nonprod` or `prod`."
}

variable "repo_url" {
  description = "The URL to the Github repo for this project."
}

variable "ci_buildspec_path" {
  description = "The path to the buildspec for CI jobs within the repo"
  default     = "buildspec.pr.yml"
}

variable "root_domain_name" {
  description = "The root domain name to attach a custom subdomain to for API Gateway."
}

variable "root_domain_name_zone_id" {
  description = "The Route53 zone ID for root_domain_name."
}

variable "repo_owner" {
  description = "The user or organization that owns the repo cloned in CI."
}

variable "repo_name" {
  description = "The name of the repo to clone in CI."
}

variable "github_token" {
  description = "The personal access token for the Github API."
  default     = ""
}

variable "sauce_access_key" {
  description = "The access key for the Sauce Labs account to target. Only have to set on first apply."
  default     = ""
}

variable "fastly_api_token" {
  description = "The API token for the Fastly provider. Only have to set on first apply."
  default     = ""
}

locals {
  prefix = "tf-${var.service_name}-${var.tier}"

  # We map tier to stage for normalization against `terraform-aws-serverless`.
  # No `var.stage` in admin.
  tags = map(
    "Service", var.service_name,
    "Tier", var.tier,
    "Stage", var.tier,
  )

  account_id = data.aws_caller_identity.current.account_id
  partition  = data.aws_partition.current.partition
}
