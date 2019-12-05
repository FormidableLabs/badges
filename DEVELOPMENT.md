# Development

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Contents

- [Application Development](#application-development)
  - [Installation](#installation)
  - [Local Development](#local-development)
  - [Deploying from a pull request](#deploying-from-a-pull-request)
- [Infrastructure / Production](#infrastructure--production)
  - [Overview](#overview)
  - [Infrastrutures](#infrastrutures)
  - [Concepts](#concepts)
  - [Installation](#installation-1)
  - [Infrastructure Development/Creation](#infrastructure-developmentcreation)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Application Development

### Installation

For development on just the server / serverless part of the application, you just need the usual.

```sh
$ git clone https://github.com/FormidableLabs/badges.git
$ cd badges
$ yarn install
```

### Local Development

Then start the server:

```sh
$ yarn start
# OR, full debug + pretty logging
$ DEBUG="badges:*" yarn start:dev
```

And try out some sample URLs that don't need additional config:

- http://127.0.0.1:3000/size/github/FormidableLabs/react-fast-compare/master/index.js
- http://127.0.0.1:3000/size/npm/victory/dist/victory.min.js?gzip=true
- http://127.0.0.1:3000/browsers?firefox=20,26&iexplore=!8,-9,10

Some of our API calls utilize secrets stored in AWS as part of the deployment process. You can still develop against these by using your appropriate AWS credentials along with the same start task:

```sh
$ AWS_REGION=<INSERT_REGION> \
  aws-vault exec <INSERT_AWS_VAULT_PROFILE> -- \
  yarn start

# Could look something like
$ AWS_REGION=us-east-1 \
  aws-vault exec jane.developer -- \
  yarn start
```

(You can provide normal AWS environment variables / local config files for credentials as an alternative, but we recommend `aws-vault` due to the enhanced security of credential use and storage.)

Then try out things like:

- http://127.0.0.1:3000/travis/infernojs/inferno/sauce/Havunen?name=InfernoJS
- http://127.0.0.1:3000/sauce/Havunen?labels=none

### Deploying from a pull request

As an application developer, everything you need to take a pull request all the way to production is managed via automation in each pull request!

- Log in to the appropriate AWS account.
- Open a pull request and wait for the CI check to complete.
- When CI completes, it posts a comment with links to the PR environment and the deployment pipeline. Verify your changes in the PR environment, then click the link to the pipeline page.
- On the pipeline page, you'll see an approval step for deploying to production. Click "Review" and then "Approve" in the modal that pops up.
- After the pipeline deploys to production, it posts a link to production in the PR. Verify your changes in prod.
- Merge the pull request!


## Infrastructure / Production

### Overview

The infrastructure for this project is automated through CI/CD. Pull requests receive comments when they pass CI that give links to both a PR preview environment and to CodePipeline for manually approving production deploys.

The project uses [GitHub Flow](https://guides.github.com/introduction/flow/). After testing an artifact in a PR environment, we deploy that same artifact to production _from_ the branch rather than from merge to `master`. It's important to be aware that an artifact built from `master` post-merge may not be exactly the same as the artifact deployed from the branch.

We use "support tiers" for managing resources shared across PR environments and for emulating multi-account isolation of `prod` and `nonprod` via IAM in a single account. These "tiers" are the only manual setup required to launch this project. In the future, we may support, and migrate to, multiple AWS accounts.

### Infrastrutures

- `terraform/admin`: Controls the underlying infrastructure for the other TF infrastructures in automation, and consequently is the **only** one that you'll need to manually change from a local machine to get everything up and running.
- `terraform/app`: Controls the application support resources like CDN, domain name, etc. Modifications handled by automation.
- `terraform/cd`: Controls the application deployment pipeline like CodeBuild, artifacts, etc. Modifications handled by automation.

### Concepts

Our infrastructures all coalesce around some common configurations that we pass on the command line through environment variables:

- `SERVICE_NAME`: Name of the application itself. In our use for this project, it's always `badges`.
- `TIER`: Name of the conceptual tier of `terraform/admin` control. We use `nonprod` for things like developer sandboxes and our per-pull-request temporary environments. We use `prod` for the production environment.
    > ℹ️ **Note**: For the [`terraform-aws-serverless`](https://registry.terraform.io/modules/FormidableLabs/serverless/aws/) module we use to control Serverless Framework application privileges, we map `TIER` to the `stage` input and then use a wildcard to map our use of `TIER-STAGE` for least-privileged IAM construction.
- `STAGE`: Unused in `terraform/admin`. For `terraform/app` and `terraform/cd`, this is a unit of separate stage to support things like per-pull-request environments like `pr123`.


Putting this all together, in `nonprod` environment you will see infrastructures like `badges-nonprod-pr123`. In production, you will see infrastructures like `badges-prod-production` as `production` is hard-coded for `STAGE`.

### Installation

If you are creating/modifying the `terraform/admin` infrastructure from your machine, you'll need:

1. [tfenv](https://github.com/tfutils/tfenv) to get a compliant version of `terraform`:

    ```sh
    $ brew install tfenv
    $ cd PATH/TO/badges
    $ tfenv install

    # Confirm version matches value in `.terraform-version`
    $ terraform --version
    Terraform v0.12.10
    ```

2. [terragrunt](https://github.com/gruntwork-io/terragrunt) installed [without dependencies](https://github.com/gruntwork-io/terragrunt/issues/580#issuecomment-479922008)

    ```sh
    $ brew install --ignore-dependencies terragrunt
    $ terragrunt --version
    ```

### Infrastructure Development/Creation

This section is for the initial setup and modification of a given `TIER` for `terraform/admin` configurations.

> ℹ️ **Note**: If you need to modify infrastructures in `terraform/{app,cd}` just edit the files and open a pull request. All the changes are taken care of automagically in automation!

- Set up your AWS credentials. We recommend [aws-vault](https://github.com/99designs/aws-vault).
    - (_For Formidables for this project_) Ask `@tptee` or `@ryan-roemer` for AWS, Fastly, Sauce, and Github credentials.
- Create/update the nonprod tier with the below command:

    ```sh
    $ FASTLY_API_TOKEN=<REDACTED> \
      SAUCE_ACCESS_KEY=<REDACTED> \
      GITHUB_TOKEN=<REDACTED> \
      SERVICE_NAME=badges \
      TIER=nonprod \
      terragrunt apply --terragrunt-working-dir terraform/admin
    ```

- Create/update the prod tier by repeating the previous command with `TIER=prod`.
- Open a PR and watch the magic happen for the rest of the infrastruction and application pieces!
