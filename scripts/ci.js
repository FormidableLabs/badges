'use strict';

const AWS = require('aws-sdk');
const execa = require('execa');
const fs = require('fs-extra');
const Octokit = require('@octokit/rest');

const uploadArtifact = require('./util/upload-artifact');
const rejectPreviousPipelineExecutions = require('./util/reject-previous-pipeline-executions');
const { postPrEnvironmentLink } = require('./util/pr-comments');

const name = process.env.SERVICE_NAME;
const tier = process.env.TIER;
const repoOwner = process.env.REPO_OWNER;
const repoName = process.env.REPO_NAME;

const stage =
  process.env.STAGE || process.env.CODEBUILD_SOURCE_VERSION.replace('/', '');
const shouldDestroy =
  process.env.CODEBUILD_WEBHOOK_EVENT === 'PULL_REQUEST_MERGED';

const cloudformation = new AWS.CloudFormation();

const { log } = console;

const execaOpts = {
  stdio: 'inherit',
  env: {
    TIER: tier,
    STAGE: stage
  }
};

const isHeadCommitOfPR = async () => {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const { data } = await octokit.pulls.listCommits({
    owner: repoOwner,
    repo: repoName,
    // eslint-disable-next-line camelcase
    pull_number: process.env.CODEBUILD_SOURCE_VERSION.replace('pr/', '')
  });

  const headCommit = data[data.length - 1].sha;
  return headCommit === process.env.CODEBUILD_RESOLVED_SOURCE_VERSION;
};

const stackReadyForDeploy = async () => {
  const stack = `sls-${name}-${tier}-${stage}`;
  const params = {
    StackName: stack
  };

  log('\nChecking if CloudFormation stack is ready...');

  await Promise.race(
    [('stackCreateComplete', 'stackUpdateComplete')].map(event =>
      cloudformation.waitFor(event, params).promise()
    )
  ).catch(err => {
    // Allow non-existent CF stack (like on initial PR creation).
    const originalError = err.originalError || {};
    if (originalError.message === `Stack with id ${stack} does not exist`) {
      log('\nCloudFormation stack does not exist (continuing)...');
      return;
    }

    throw err;
  });

  log('CloudFormation stack is ready\n\n');
};

const getTerragruntArgs = (command, workingDir) =>
  [].concat(
    command,
    [
      '-auto-approve',
      '--terragrunt-non-interactive',
      '--terragrunt-working-dir'
    ],
    workingDir
  );

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
  await stackReadyForDeploy();

  if (!(await isHeadCommitOfPR())) {
    throw new Error('Commit is not at head of PR branch. Aborting...');
  }
  await execa('yarn', ['sls', 'deploy', '--package', '.serverless'], execaOpts);

  // Apply any Terraform that accommodates this stage.
  await execa(
    'terragrunt',
    getTerragruntArgs('apply', 'terraform/app'),
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
    getTerragruntArgs('apply', 'terraform/cd'),
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
    getTerragruntArgs('destroy', 'terraform/cd'),
    execaOpts
  );

  // Destroy any Terraform accommodating this stage.
  await execa(
    'terragrunt',
    getTerragruntArgs('destroy', 'terraform/app'),
    execaOpts
  );

  // Destroy the Serverless app.
  await execa.command('yarn sls remove', execaOpts);
};

const main = async () => {
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
  main()
    // The AWS SDK `waitFor` method sets up listeners without a straightforward way to cancel them.
    // This will cause the process to hang so force exit here...
    // eslint-disable-next-line no-process-exit
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    });
}
