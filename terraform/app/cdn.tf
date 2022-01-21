locals {
  origin_host = aws_api_gateway_domain_name.custom_domain.domain_name
  domain      = var.stage == "production" ? "${var.service_name}.global.ssl.fastly.net" : "${var.service_name}-${var.tier}-${var.stage}.global.ssl.fastly.net"
}

resource "fastly_service_v1" "cdn" {
  name = local.prefix

  default_ttl  = 0
  default_host = local.origin_host

  domain {
    name    = "${var.service_name}-${var.tier}-${var.stage}.global.ssl.fastly.net"
    comment = "Fastly service for static assets and dynamic content"
  }

  domain {
    name    = local.origin_host
    comment = "Origin domain to enable host override with shielding"
  }

  dynamic "domain" {
    for_each = var.stage == "production" ? [1] : []

    content {
      name    = "${var.service_name}.${var.root_domain_name}"
      comment = "Production domain with SSL"
    }
  }

  backend {
    address = local.origin_host
    name    = "${local.prefix}-backend-apigateway"
    port    = 443

    # Ashburn, Virginia (closest to AWS us-east-1).
    #
    # See the guide at: https://developer.fastly.com/learning/concepts/shielding/#choosing-a-shield-location
    # for a list of cloud provider DCs to shield locations.
    #
    # To programmatically get a list of POPs, try the following (assumes `jq` installed):
    #
    # ```sh
    # $ ( FASTLY_API_TOKEN=<SNIPPED>; \
    #     curl -sS https://api.fastly.com/datacenters \
    #       -H "Fastly-Key: ${FASTLY_API_TOKEN}" |  jq )
    # ```
    shield = "iad-va-us"

    use_ssl           = true
    min_tls_version   = "1.2"
    max_tls_version   = "1.2"
    ssl_cert_hostname = var.root_domain_name
    ssl_sni_hostname  = "*.${var.root_domain_name}"
  }

  # These are the default settings–there's just no way to toggle on the defaults
  # in the Terraform provider like there is in the UI
  gzip {
    name       = "default"
    extensions = ["js", "css", "html", "json", "ico", "eot", "otf", "ttf"]

    content_types = [
      "text/html",
      "application/x-javascript",
      "text/css",
      "application/javascript",
      "text/javascript",
      "text/plain",
      "text/xml",
      "application/json",
      "application/vnd.ms-fontobject",
      "application/x-font-opentype",
      "application/x-font-truetype",
      "application/x-font-ttf",
      "application/xml",
      "font/eot",
      "font/opentype",
      "font/otf",
      "image/svg+xml",
      "image/vnd.microsoft.icon",
    ]
  }

  snippet {
    name = "authenticate_purge_requests"
    type = "recv"

    content = <<EOF
if (req.method == "FASTLYPURGE") {
  set req.http.Fastly-Purge-Requires-Auth = "1";
}
EOF
  }

  snippet {
    name = "fix_shield_stale_while_revalidate"
    type = "recv"

    content = <<EOF
if (req.http.Fastly-FF) {
  set req.max_stale_while_revalidate = 0s;
}
EOF
  }

  # TODO: add a bucket for Fastly logs.
  # https://github.com/FormidableLabs/badges/issues/16
  # s3logging {
  #   name           = "TODO"
  #   bucket_name    = "TODO"
  #   path           = "fastly"
  #   format_version = 2
  #   gzip_level     = 9


  #   # Log every 30 minutes
  #   period = 1800
  # }

  force_destroy = true
}

resource "aws_route53_record" "cdn" {
  # Only add this CNAME for production
  count = var.stage == "production" ? 1 : 0

  zone_id = var.root_domain_name_zone_id
  name    = var.service_name
  type    = "CNAME"
  ttl     = "5"

  records = [var.fastly_cname_domain]
}