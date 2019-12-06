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

variable "deployment_stages" {
  description = "A list of stage maps that provide a stage name and domain."
  type        = "list"
}

variable "buildspec_path" {
  description = "The path to the buildspec.yml file relative to the repo root."
  default     = "buildspec.cd.yml"
}

variable "root_domain_name" {
  description = "The root domain name to attach a custom subdomain to for API Gateway."
}

variable "repo_owner" {
  description = "The user or organization that owns the repo cloned in CI."
}

variable "repo_name" {
  description = "The name of the repo to clone in CI."
}

locals {
  prefix     = "tf-${var.service_name}-${var.tier}-${var.stage}"
  account_id = data.aws_caller_identity.current.account_id
  partition  = data.aws_partition.current.partition

  enabled = var.tier != "prod"
  count   = local.enabled ? 1 : 0

  tags = map(
    "Service", var.service_name,
    "Tier", var.tier,
    "Stage", var.tier,
    "TierStage", var.stage,
  )
}

