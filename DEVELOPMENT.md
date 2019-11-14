## Install

### Development

Clone the repository:

```sh
$ git clone https://github.com/FormidableLabs/badges.git
$ cd badges
```

Install dependencies. Note that one of the dependencies is
[node-canvas](https://github.com/Automattic/node-canvas), which has system
requirements that must be satisfied outside of npm.

```sh
$ yarn
```

Then start the server:

```sh
$ yarn start
```

And try out some sample URLs:

- http://127.0.0.1:3000/size/github/FormidableLabs/react-fast-compare/master/index.js
- http://127.0.0.1:3000/travis/infernojs/inferno/sauce/Havunen?name=InfernoJS
- http://127.0.0.1:3000/size/npm/victory/dist/victory.min.js?gzip=true
- http://127.0.0.1:3000/sauce/Havunen?labels=none
- http://127.0.0.1:3000/browsers?firefox=20,26&iexplore=!8,-9,10

### Infrastructure / Production

The infrastructure for this project is automated through CI/CD. Pull requests receive comments when they pass CI that give links to both a PR preview environment and to CodePipeline for manually approving production deploys.

The project uses [GitHub Flow](https://guides.github.com/introduction/flow/). After testing an artifact in a PR environment, we deploy that same artifact to production _from_ the branch rather than from merge to `master`. It's important to be aware that an artifact built from `master` post-merge may not be exactly the same as the artifact deployed from the branch.

We use "support tiers" for managing resources shared across PR environments and for emulating multi-account isolation of prod and nonprod via IAM in a single account. These "tiers" are the only manual setup required to launch this project. In the future, we may support, and migrate to, multiple AWS accounts.

#### Initial setup

- Set up your AWS credentials. We recommend [aws-vault](https://github.com/99designs/aws-vault).
- Create the nonprod tier with the below command:

```sh
$ FASTLY_API_TOKEN=<REDACTED> \
  SAUCE_ACCESS_KEY=<REDACTED> \
  GITHUB_TOKEN=<REDACTED> \
  SERVICE_NAME=badges \
  TIER=nonprod \
  terragrunt apply --terragrunt-working-dir terraform/admin
```

- Create the prod tier by repeating the previous command with `TIER=prod`.
- Open a PR and watch the magic happen!

_For Formidables for this project_:

- Ask `@tptee` or `@ryan-roemer` for AWS, Fastly, Sauce, and Github credentials.

#### Deploying from a pull request

- Log in to the appropriate AWS account.
- Open a pull request and wait for the CI check to complete.
- When CI completes, it posts a comment with links to the PR environment and the deployment pipeline. Verify your changes in the PR environment, then click the link to the pipeline page.
- On the pipeline page, you'll see an approval step for deploying to production. Click "Review" and then "Approve" in the modal that pops up.
- After the pipeline deploys to production, it posts a link to production in the PR. Verify your changes in prod.
- Merge the pull request!
