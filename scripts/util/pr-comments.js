/* eslint-disable camelcase */

'use strict';

const AWS = require('aws-sdk');
const Octokit = require('@octokit/rest');
const { memoize } = require('lodash');

const secretsManager = new AWS.SecretsManager();

const region = process.env.AWS_REGION;

const { REPO_OWNER, REPO_NAME, ROOT_DOMAIN, PR_STAGE } = process.env;

const getOctokitClient = memoize(async (name, tier) => {
  const { SecretString } = await secretsManager
    .getSecretValue({ SecretId: `tf-${name}-${tier}-github-token` })
    .promise();

  return new Octokit({ auth: SecretString });
});

const postPrEnvironmentLink = async ({ name, stage, tier }) => {
  const octokit = await getOctokitClient(name, tier);

  const endpoint = `https://${name}-${tier}-${stage}.freetls.fastly.net`;

  const body = `
Deployed PR environment to ${endpoint}!

If you are an admin, deploy to production from the [pipeline page in AWS](https://${region}.console.aws.amazon.com/codesuite/codepipeline/pipelines/tf-${name}-${tier}-${stage}/view?region=${region}).`;

  // convert stage name pr7 to the number 7 for the issues API
  const issueNumber = stage.replace('pr', '');

  await octokit.issues.createComment({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: issueNumber,
    body
  });
};

const postDeploymentLink = async ({ name, stage, tier }) => {
  const octokit = await getOctokitClient(name, tier);

  const endpoint = `https://${name}${
    stage === 'production' ? '' : `-${stage}`
  }.${ROOT_DOMAIN}`;

  const body = `Deployed this PR to ${stage}! View at ${endpoint}!`;

  // convert stage name pr7 to the number 7 for the issues API
  const issueNumber = PR_STAGE.replace('pr', '');

  await octokit.issues.createComment({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: issueNumber,
    body
  });
};

module.exports = {
  postPrEnvironmentLink,
  postDeploymentLink
};
