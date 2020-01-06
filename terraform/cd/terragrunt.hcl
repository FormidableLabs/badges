terraform {
  source = ".//"
}

remote_state {
  backend = "s3"

  config = {
    region = "us-east-1"

    bucket  = "tf-${get_env("SERVICE_NAME", "badges")}-${get_env("TIER", "nonprod")}-${get_env("STAGE", "sandbox")}cd-remote-state"
    key     = "terraform-cd.tfstate"
    encrypt = true

    dynamodb_table = "tf-${get_env("SERVICE_NAME", "badges")}-${get_env("TIER", "nonprod")}-${get_env("STAGE", "sandbox")}cd-remote-locks"
  }
}

inputs = {
  region       = "us-east-1"
  service_name = "${get_env("SERVICE_NAME", "badges")}"
  tier         = "${get_env("TIER", "nonprod")}"
  stage        = "${get_env("STAGE", "sandbox")}"

  repo_url = "https://github.com/FormidableLabs/badges"
  repo_owner = "FormidableLabs"
  repo_name = "badges"

  root_domain_name = "formidable.com"

  deployment_stages = [{
    name = "production",
    tier = "prod"
    url = "${get_env("SERVICE_NAME", "badges")}.formidable.com",
  }]

  terraform_lock_timeout_duration = "20m"
}
