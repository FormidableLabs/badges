locals {
  # This iteration may seem strange, but it's an example of how to create a
  # multi-stage pipeline with manual approvals before each deploy. For example,
  # a pipeline with a stage and production environment would look like:
  # stage approval -> stage deploy -> production approval -> production deploy.
  # We only need production for now, but this is a good reference.
  deployment_stages_list = flatten(
    [
      for index, stage in var.deployment_stages :
      [
        {
          # Terraform's for_each only accepts maps, but orders its iteration
          # lexicographically by map key. This doesn't let us ensure the order
          # of each approval -> deploy step. Use ordered number prefixes in the
          # keys to ensure iteration order.
          key = "${index}-1-approve-${stage["name"]}",
          name = "${stage["name"]}-approve",
          tier = stage["tier"],
          url = stage["url"],
          approval = true
        },
        {
          key = "${index}-2-deploy-${stage["name"]}",
          name = stage["name"],
          tier = stage["tier"],
          url = stage["url"],
        }
      ]
    ]
  )
  deployment_stages = {
    for stage in local.deployment_stages_list : stage["key"] => stage
  }
  codebuild_deployment_projects = {
    for stage in local.deployment_stages_list : stage["key"] => stage if !lookup(stage, "approval", false)
  }
  service_role_arn = "arn:${local.partition}:iam::${local.account_id}:role/tf-${var.service_name}-${var.tier}-role-ci"
  artifacts_bucket = "tf-${var.service_name}-${var.tier}-artifacts-${local.account_id}"
}

resource "aws_codepipeline" "cd" {
  depends_on = [aws_codebuild_project.cd]

  name     = local.prefix
  role_arn = local.service_role_arn

  # Note that we use the S3 source instead of the GitHub one. This is because
  # the GitHub source doesn't support arbitrary branch names.
  artifact_store {
    type     = "S3"
    location = local.artifacts_bucket
  }

  stage {
    name = "Source"

    action {
      name             = "Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "S3"
      version          = "1"
      output_artifacts = ["build"]

      configuration = {
        S3Bucket = local.artifacts_bucket
        S3ObjectKey  = "artifact-${var.service_name}-${var.tier}-${var.stage}.zip"
      }
    }
  }

  # Create an approval action before each stage's deploy.
  dynamic stage {
    for_each = local.deployment_stages

    content {
      name = stage.value["name"]

      action {
        name             = stage.value["name"]
        category         = lookup(stage.value, "approval", false) ? "Approval" : "Build"
        owner            = "AWS"
        provider         = lookup(stage.value, "approval", false) ? "Manual" : "CodeBuild"
        version          = "1"

        input_artifacts  = lookup(stage.value, "approval", false) ? null : ["build"]
        output_artifacts = lookup(stage.value, "approval", false) ? null : []

        configuration = {
          # CodeBuild only
          ProjectName = lookup(stage.value, "approval", false) ? null : "tf-${var.service_name}-${stage.value["tier"]}-${var.stage}-${stage.value["name"]}-cd"

          # Manual only
          CustomData         = lookup(stage.value, "approval", false) ? "Validate your changes in this stage before approving." : null
          ExternalEntityLink = lookup(stage.value, "approval", false) ? stage.value["url"] : null
        }
      }
    }
  }
}

resource "aws_codebuild_project" "cd" {
  for_each = local.codebuild_deployment_projects

  name          = "tf-${var.service_name}-${each.value["tier"]}-${var.stage}-${each.value["name"]}-cd"
  description   = "${each.value["name"]} CD for PR ${local.prefix}"
  service_role  = "arn:${local.partition}:iam::${local.account_id}:role/tf-${var.service_name}-${each.value["tier"]}-role-ci"
  build_timeout = "10"

  source {
    type = "CODEPIPELINE"
  }

  artifacts {
    type = "CODEPIPELINE"
  }

  cache {
    type  = "LOCAL"
    modes = ["LOCAL_DOCKER_LAYER_CACHE", "LOCAL_SOURCE_CACHE"]
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:2.0"
    type                        = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "GITHUB_TOKEN"
      value = "/aws/reference/secretsmanager/tf-${var.service_name}-${each.value["tier"]}-github-token"
      type  = "PARAMETER_STORE"
    }

    environment_variable {
      name  = "SERVICE_NAME"
      value = var.service_name
    }

    environment_variable {
      name  = "TIER"
      value = each.value["tier"]
    }

    environment_variable {
      name  = "STAGE"
      value = each.value["name"]
    }

    environment_variable {
      name  = "URL"
      value = each.value["url"]
    }

    # Used for posting comments on PRs
    environment_variable {
      name  = "PR_STAGE"
      value = var.stage
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

  tags = {
    Tier    = each.value["tier"]
    Service = var.service_name
  }
}

