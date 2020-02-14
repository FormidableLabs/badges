Changes
=======

## UNRELEASED

- Bugfix: Allow empty Serverless CloudFormation stack when checking if stack is ready. [#49](https://github.com/FormidableLabs/badges/pull/49)
- Infra: Update Fastly shield POP to `bwi-va-us`.
- Deps: Upgrade all dependencies to latest.
- Infra: Only create S3 artifacts bucket for non-`prod`.

## 7.5.1

- Infra: Add tags to all Terraform resources that could add them.
- Infra: Add tags to Serverless resources + stack.
- Infra: Add admin meta resource group for service + tier (as "Stage" to match Serverless and terraform-aws-serverless)
- Infra: Add `--reconfigure` to all `terraform init` commands in Terragrunt.- Build: Add `terraform fmt` to `yarn build` and format all Terraform code.
- Infra: Update `FormidableLabs/serverless/aws` to `0.8.5`
- Docs: Add TOC to `DEVELOPMENT.md`.
- Docs: Add more instructions about wrangling `terraform/admin` and making infrastructure changes.
- Docs: Add more discussion of our CI/CD strategy.
