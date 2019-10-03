resource "aws_secretsmanager_secret" "sauce_access_key" {
  name                    = "${local.prefix}-sauce-access-key"
  description             = "The access key for the Sauce Labs account to target."
  recovery_window_in_days = 0

  lifecycle {
    ignore_changes = ["name"]
  }
}

resource "aws_secretsmanager_secret_version" "sauce_access_key" {
  secret_id     = aws_secretsmanager_secret.sauce_access_key.id
  secret_string = var.sauce_access_key

  lifecycle {
    ignore_changes = ["secret_string"]
  }
}

resource "aws_secretsmanager_secret" "fastly_api_token" {
  name                    = "${local.prefix}-fastly-api-token"
  description             = "The API token for the Fastly provider."
  recovery_window_in_days = 0

  lifecycle {
    ignore_changes = ["name"]
  }
}

resource "aws_secretsmanager_secret_version" "fastly_api_token" {
  secret_id     = aws_secretsmanager_secret.fastly_api_token.id
  secret_string = var.fastly_api_token

  lifecycle {
    ignore_changes = ["secret_string"]
  }
}

resource "aws_secretsmanager_secret" "github_token" {
  name                    = "${local.prefix}-github-token"
  description             = "The personal access token for the Github API."
  recovery_window_in_days = 0

  lifecycle {
    ignore_changes = ["name"]
  }
}

resource "aws_secretsmanager_secret_version" "github_token" {
  secret_id     = aws_secretsmanager_secret.github_token.id
  secret_string = var.github_token

  lifecycle {
    ignore_changes = ["secret_string"]
  }
}

resource "aws_iam_role_policy_attachment" "secrets" {
  role       = module.serverless.lambda_role_name
  policy_arn = aws_iam_policy.secrets.arn
}

resource "aws_iam_role_policy_attachment" "secrets_ci" {
  role       = aws_iam_role.ci.name
  policy_arn = aws_iam_policy.secrets.arn
}

resource "aws_iam_policy" "secrets" {
  name   = "${local.prefix}-secrets"
  policy = data.aws_iam_policy_document.secrets.json
}

data "aws_iam_policy_document" "secrets" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]

    resources = [
      aws_secretsmanager_secret.sauce_access_key.arn,
      aws_secretsmanager_secret.fastly_api_token.arn,
      aws_secretsmanager_secret.github_token.arn
    ]
  }

  statement {
    actions = ["ssm:GetParameters"]

    resources = [
      for name in ["sauce-access-key", "fastly-api-token", "github-token"] :
        "arn:${local.partition}:ssm:${var.region}:${local.account_id}:parameter/aws/reference/secretsmanager/${local.prefix}-${name}"
    ]
  }
}
