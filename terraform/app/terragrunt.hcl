terraform {
  source = ".//"
}

remote_state {
  backend = "s3"

  config = {
    region = "us-east-1"

    bucket  = "tf-${get_env("SERVICE_NAME", "badges")}-${get_env("TIER", "nonprod")}-${get_env("STAGE", "sandbox")}-remote-state"
    key     = "terraform-app.tfstate"
    encrypt = true

    dynamodb_table = "tf-${get_env("SERVICE_NAME", "badges")}-${get_env("TIER", "nonprod")}-${get_env("STAGE", "sandbox")}-remote-locks"
  }
}

inputs = {
  region       = "us-east-1"
  service_name = "${get_env("SERVICE_NAME", "badges")}"
  tier         = "${get_env("TIER", "nonprod")}"
  stage        = "${get_env("STAGE", "sandbox")}"

  root_domain_name                          = "formidable.com"
  root_domain_name_zone_id                  = "Z11V9C4SUTC8Q6"
  root_domain_name_wildcard_certificate_arn = "arn:aws:acm:us-east-1:819013376994:certificate/e8e4f85e-ed16-4f41-a0b3-fd1fb46b9eaa"

  fastly_cname_domain = "j3.shared.global.fastly.net"
}
