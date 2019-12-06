terraform {
  source = ".//"

  extra_arguments "env" {
    commands = ["init", "apply", "refresh", "import", "plan", "taint", "untaint"]

    env_vars = {
      TF_VAR_github_token = "${get_env("GITHUB_TOKEN", "")}"
      TF_VAR_sauce_access_key = "${get_env("SAUCE_ACCESS_KEY", "")}"
      TF_VAR_fastly_api_token = "${get_env("FASTLY_API_TOKEN", "")}"
    }
  }

  extra_arguments "init_args" {
    commands = [
      "init"
    ]

    # Always treat remote backend state as controlling.
    arguments = [
      "--reconfigure",
    ]
  }
}

remote_state {
  backend = "s3"

  config = {
    region = "us-east-1"

    bucket  = "tf-${get_env("SERVICE_NAME", "badges")}-${get_env("TIER", "nonprod")}-remote-state"
    key     = "terraform.tfstate"
    encrypt = true

    dynamodb_table = "tf-${get_env("SERVICE_NAME", "badges")}-${get_env("TIER", "nonprod")}-remote-locks"
  }
}

inputs = {
  region       = "us-east-1"
  service_name = "${get_env("SERVICE_NAME", "badges")}"
  tier         = "${get_env("TIER", "nonprod")}"

  repo_url = "https://github.com/FormidableLabs/badges"
  repo_owner = "FormidableLabs"
  repo_name = "badges"

  root_domain_name         = "formidable.com"
  root_domain_name_zone_id = "Z11V9C4SUTC8Q6"
}
