locals {
  artifacts_bucket_iam_arn = "arn:${local.partition}:s3:::tf-${var.service_name}-*-artifacts-${local.account_id}"
}

resource "aws_iam_role" "ci" {
  name               = "tf-${var.service_name}-${var.tier}-role-ci"
  assume_role_policy = data.aws_iam_policy_document.ci_assume.json
}

data "aws_iam_policy_document" "ci_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type = "Service"

      identifiers = [
        "codebuild.amazonaws.com",
        "codepipeline.amazonaws.com",
      ]
    }
  }

  # Allow this account to use policies that grant assume role access to principals.
  # https://stackoverflow.com/a/34943188
  # "Also, attach a Trust Policy on the Role. The sample policy (below) trusts any user in the account,
  # but they would also need sts:AssumeRole permissions (above) to assume the role."
  # "trusting sts:AssumeRole to ..:root user only POTENTIALLY allows any user to assume the role in
  # question. Unless you also grant the permission to some user or group to assume the role, it
  # will not be allowed.
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.account_id}:root"]
    }
  }
}

# Attach policies from main and child modules to this role
resource "aws_iam_role_policy_attachment" "ci" {
  role       = aws_iam_role.ci.name
  policy_arn = module.serverless.iam_policy_ci_arn
}

resource "aws_iam_role_policy_attachment" "ci_admin" {
  role       = aws_iam_role.ci.name
  policy_arn = module.serverless.iam_policy_admin_arn
}

resource "aws_iam_role_policy_attachment" "ci_cd_lambdas" {
  role       = aws_iam_role.ci.name
  policy_arn = module.serverless.iam_policy_cd_lambdas_arn
}

resource "aws_iam_role_policy_attachment" "ci_canary" {
  role       = aws_iam_role.ci.name
  policy_arn = module.serverless_canary.iam_policy_ci_arn
}

resource "aws_iam_group_policy_attachment" "ci_role" {
  group      = module.serverless.iam_group_ci_name
  policy_arn = aws_iam_policy.ci_role.arn
}

resource "aws_iam_role_policy_attachment" "ci_role" {
  role       = aws_iam_role.ci.name
  policy_arn = aws_iam_policy.ci_role.arn
}

resource "aws_iam_policy" "ci_role" {
  name   = "tf-${var.service_name}-${var.tier}-policy-ci-role"
  policy = data.aws_iam_policy_document.ci_role.json
}

data "aws_iam_policy_document" "ci_role" {
  statement {
    actions = [
      "sts:AssumeRole",
      "iam:GetRole",
      "iam:PassRole"
    ]
    resources = ["arn:${local.partition}:iam::${local.account_id}:role/tf-${var.service_name}-*-role-ci"]
  }

  # Terragrunt remote backend
  statement {
    actions = [
      "s3:ListBucket",
      "s3:CreateBucket",
      "s3:DeleteBucket",
      "s3:GetBucketVersioning",
      "s3:PutBucketVersioning",
      "s3:GetEncryptionConfiguration",
      "s3:PutEncryptionConfiguration",
      "s3:GetBucketPublicAccessBlock",
      "s3:PutBucketPublicAccessBlock",
      "s3:GetBucketAcl",
      "s3:PutBucketAcl",
      "s3:GetBucketLogging",
      "s3:PutBucketLogging",
    ]

    resources = ["arn:${local.partition}:s3:::${local.prefix}-*-remote-state"]
  }

  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]

    resources = ["arn:${local.partition}:s3:::${local.prefix}-*-remote-state/*"]
  }

  statement {
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:DescribeTable",
      "dynamodb:DeleteItem",
      "dynamodb:CreateTable"
    ]

    resources = ["arn:${local.partition}:dynamodb:${var.region}:${local.account_id}:table/tf-${var.service_name}-${var.tier}-*-remote-locks"]
  }

  # API Gateway custom domain IAM adapted from:
  # https://serverless.com/plugins/serverless-domain-manager/
  statement {
    actions = [
      "apigateway:POST",
    ]

    resources = ["arn:${local.partition}:apigateway:${var.region}::/domainnames"]
  }

  statement {
    actions = [
      "apigateway:GET",
      "apigateway:DELETE",
    ]

    resources = [
      "arn:${local.partition}:apigateway:${var.region}::/domainnames/${var.service_name}-${var.tier}-*.${var.root_domain_name}"
    ]
  }

  statement {
    actions = [
      "apigateway:POST",
    ]

    resources = [
      "arn:${local.partition}:apigateway:${var.region}::/domainnames/${var.service_name}-${var.tier}-*.${var.root_domain_name}/basepathmappings"
    ]
  }

  statement {
    actions = [
      "apigateway:GET",
      "apigateway:POST",
      "apigateway:PATCH",
      "apigateway:DELETE",
    ]

    resources = [
      "arn:${local.partition}:apigateway:${var.region}::/domainnames/${var.service_name}-${var.tier}-*.${var.root_domain_name}/basepathmappings/*"
    ]
  }

  statement {
    actions = [
      "route53:GetChange",
    ]

    resources = ["*"]
  }

  statement {
    actions = [
      "route53:GetHostedZone",
      "route53:ChangeResourceRecordSets",
      "route53:ListResourceRecordSets",
    ]

    resources = ["arn:${local.partition}:route53:::hostedzone/${var.root_domain_name_zone_id}"]
  }

  # CodeBuild
  statement {
    actions = [
      "logs:CreateLogGroup",
    ]

    # Necessary wildcard.
    # https://docs.aws.amazon.com/IAM/latest/UserGuide/list_amazoncloudwatchlogs.html#amazoncloudwatchlogs-log-group
    resources = ["*"]
  }

  statement {
    actions = [
      "logs:DeleteLogGroup"
    ]

    resources = [
      "arn:${local.partition}:logs:${var.region}:${local.account_id}:log-group:/aws/codebuild/${local.prefix}-*"
    ]
  }

  statement {
    actions = [
      "logs:CreateLogStream",
      "logs:DeleteLogStream",
      "logs:PutLogEvents",
    ]

    resources = [
      "arn:${local.partition}:logs:${var.region}:${local.account_id}:log-group:/aws/codebuild/${local.prefix}-*:*"
    ]
  }

  # Codebuild artifact bucket
  statement {
    actions = [
      "s3:GetBucketAcl",
      "s3:GetBucketLocation",
      "s3:GetBucketVersioning",
    ]

    resources = [
      local.artifacts_bucket_iam_arn,
    ]
  }

  statement {
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
    ]

    resources = [
      "${local.artifacts_bucket_iam_arn}/*",
    ]
  }

  # CodePipeline support
  statement {
    actions = [
      "codepipeline:GetJobDetails",
    ]

    # Necessary wildcard.
    # https://docs.aws.amazon.com/IAM/latest/UserGuide/list_awscodepipeline.html#awscodepipeline-pipeline
    resources = ["*"]
  }

  statement {
    actions = [
      "codepipeline:CreatePipeline",
      "codepipeline:GetPipeline",
      "codepipeline:GetPipelineExecution",
      "codepipeline:GetPipelineState",
      "codepipeline:ListPipelines",
      "codepipeline:ListPipelineExecutions",
      "codepipeline:ListActionExecutions",
      "codepipeline:StartPipelineExecution",
      "codepipeline:UpdatePipeline",
      "codepipeline:DeletePipeline",

      "codepipeline:TagResource",
      "codepipeline:ListTagsForResource",
      "codepipeline:UntagResource",
    ]

    resources = ["arn:${local.partition}:codepipeline:${var.region}:${local.account_id}:${local.prefix}-*"]
  }

  statement {
    actions = [
      "codepipeline:PutActionRevision",
      "codepipeline:PutApprovalResult",
    ]

    resources = [
      "arn:${local.partition}:codepipeline:${var.region}:${local.account_id}:${local.prefix}-*/*"
    ]
  }

  statement {
    actions = [
      "codebuild:CreateProject",
      "codebuild:BatchGetProjects",
      "codebuild:UpdateProject",
      "codebuild:DeleteProject",
      "codebuild:StartBuild",
      "codebuild:BatchGetBuilds",
    ]

    resources = [
      # Allow nonprod to start prod CodeBuild jobs
      "arn:${local.partition}:codebuild:${var.region}:${local.account_id}:project/tf-${var.service_name}-*",
    ]
  }
}
