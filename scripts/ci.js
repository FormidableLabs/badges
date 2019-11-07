'use strict';

const fs = require('fs-extra');
const execa = require('execa');

const uploadArtifact = require('./util/upload-artifact');
const rejectPreviousPipelineExecutions = require('./util/reject-previous-pipeline-executions');
const { postPrEnvironmentLink } = require('./util/pr-comments');

const name = process.env.SERVICE_NAME;
const tier = process.env.TIER;
const stage =
  process.env.STAGE || process.env.CODEBUILD_SOURCE_VERSION.replace('/', '');
const shouldDestroy =
  process.env.CODEBUILD_WEBHOOK_EVENT === 'PULL_REQUEST_MERGED';

const execaOpts = {
  stdio: 'inherit',
  env: {
    TIER: tier,
    STAGE: stage
  }
};

const create = async () => {
  // If testing locally, removes any leftover artifact folders to ensure that
  // they don't get repackaged during `sls package`.
  await fs.remove('serverless-artifact.zip');

  await execa.command('yarn test', execaOpts);

  // Package the Serverless artifact and extract it from the .serverless folder.
  await execa.command('yarn sls package', execaOpts);
  await fs.copy(
    `.serverless/sls-${name}-${tier}.zip`,
    'serverless-artifact.zip'
  );

  // Deploy the Serverless package to the PR environment.
  await execa('yarn', ['sls', 'deploy', '--package', '.serverless'], execaOpts);

  // Apply any Terraform that accommodates this stage.
  await execa(
    'terragrunt',
    [
      'apply',
      '-auto-approve',
      '--terragrunt-non-interactive',
      '--terragrunt-working-dir',
      'terraform/app'
    ],
    execaOpts
  );

  // CodePipeline's default behavior is to queue up new builds while it waits
  // for manual approval of old builds. We don't care about old builds, so we
  // programmatically reject the manual approval step of the previous pipeline
  // execution/build.
  await rejectPreviousPipelineExecutions({ name, tier, stage });

  // Upload the Serverless artifact to S3.
  await uploadArtifact({ name, tier, stage });

  // Create the CD pipeline for deploying this PR to production.
  await execa(
    'terragrunt',
    [
      'apply',
      '-auto-approve',
      '--terragrunt-non-interactive',
      '--terragrunt-working-dir',
      'terraform/cd'
    ],
    execaOpts
  );

  await Promise.all([
    // Post a link to the PR with the PR environment URL.
    postPrEnvironmentLink({ name, tier, stage }),
    // Remove the artifact now that it's in S3.
    fs.remove('serverless-artifact.zip')
  ]);
};

const destroy = async () => {
  // Destroy the CD pipeline for this PR.
  await execa(
    'terragrunt',
    [
      'destroy',
      '-auto-approve',
      '--terragrunt-non-interactive',
      '--terragrunt-working-dir',
      'terraform/cd'
    ],
    execaOpts
  );

  // Destroy any Terraform accommodating this stage.
  await execa(
    'terragrunt',
    [
      'destroy',
      '-auto-approve',
      '--terragrunt-non-interactive',
      '--terragrunt-working-dir',
      'terraform/app'
    ],
    execaOpts
  );

  // Destroy the Serverless app.
  await execa.command('yarn sls remove', execaOpts);
};

const main = () => {
  if (!tier) {
    throw new Error('Tier not provided.');
  }
  if (!stage) {
    throw new Error('Stage not provided.');
  }

  if (shouldDestroy) {
    return destroy();
  }

  return create();
};

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  });
}
