data "aws_api_gateway_rest_api" "serverless" {
  name = "${var.stage}-sls-${var.service_name}-${var.tier}"
}

locals {
  api_id      = data.aws_api_gateway_rest_api.serverless.id
  domain_name = "${var.service_name}-${var.tier}-${var.stage}.${var.root_domain_name}"
}

resource "aws_api_gateway_domain_name" "custom_domain" {
  domain_name              = local.domain_name
  regional_certificate_arn = var.root_domain_name_wildcard_certificate_arn

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = local.tags
}

resource "aws_api_gateway_base_path_mapping" "custom_domain" {
  domain_name = aws_api_gateway_domain_name.custom_domain.domain_name
  api_id      = local.api_id
  stage_name  = var.stage
}

resource "aws_route53_record" "custom_domain" {
  name    = local.domain_name
  zone_id = var.root_domain_name_zone_id
  type    = "A"

  alias {
    name                   = aws_api_gateway_domain_name.custom_domain.regional_domain_name
    zone_id                = aws_api_gateway_domain_name.custom_domain.regional_zone_id
    evaluate_target_health = true
  }
}
