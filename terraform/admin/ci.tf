locals {
  # Don't create a CI project in production!
  # We only need CI in nonprod, which is allowed to deploy to production.
  ci_count = var.tier == "prod" ? 0 : 1
}

resource "aws_s3_bucket" "artifacts" {
  bucket        = "${local.prefix}-artifacts-${local.account_id}"
  acl           = "private"
  force_destroy = true

  # CodePipeline requires versioned buckets.
  versioning {
    enabled = true
  }

  tags = local.tags
}

resource "aws_codebuild_project" "pr_ci" {
  count = local.ci_count

  name          = "${local.prefix}-pr-ci"
  description   = "Runs CI for pull requests in ${local.prefix}"
  service_role  = aws_iam_role.ci.arn
  build_timeout = "30"

  artifacts {
    type = "NO_ARTIFACTS"
  }

  cache {
    type  = "LOCAL"
    modes = ["LOCAL_DOCKER_LAYER_CACHE", "LOCAL_SOURCE_CACHE"]
  }

  environment {
    image_pull_credentials_type = "CODEBUILD"
    type                        = "LINUX_CONTAINER"
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:2.0"

    # Used for posting comments on PRs
    environment_variable {
      name  = "GITHUB_TOKEN"
      value = "/aws/reference/secretsmanager/${local.prefix}-github-token"
      type  = "PARAMETER_STORE"
    }

    environment_variable {
      name  = "SERVICE_NAME"
      value = var.service_name
    }

    environment_variable {
      name  = "TIER"
      value = var.tier
    }

    # Used for posting comments on PRs
    environment_variable {
      name  = "REPO_OWNER"
      value = var.repo_owner
    }

    # Used for posting comments on PRs
    environment_variable {
      name  = "REPO_NAME"
      value = var.repo_name
    }

    # Used for posting comments on PRs
    environment_variable {
      name  = "ROOT_DOMAIN"
      value = var.root_domain_name
    }

    environment_variable {
      name  = "TF_IN_AUTOMATION"
      value = "1"
    }

    environment_variable {
      name  = "TF_CLI_ARGS"
      value = "-no-color"
    }
  }

  source {
    type                = "GITHUB"
    location            = var.repo_url
    buildspec           = var.ci_buildspec_path
    report_build_status = true
    git_clone_depth     = 1

    auth {
      type = "OAUTH"
    }
  }

  tags = local.tags
}

resource "aws_codebuild_webhook" "pr_ci" {
  count = local.ci_count

  project_name = aws_codebuild_project.pr_ci[count.index].name

  filter_group {
    filter {
      type    = "EVENT"
      pattern = "PULL_REQUEST_CREATED,PULL_REQUEST_UPDATED,PULL_REQUEST_REOPENED,PULL_REQUEST_MERGED"
    }
  }
}
