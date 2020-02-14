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

const firstCaps = str => str.replace(/.{1}/, m => m.toUpperCase());

const getExamples = ({ endpoint }) =>
  [
    'size/github/FormidableLabs/react-fast-compare/master/index.js',
    'size/npm/victory/dist/victory.min.js?gzip=true',
    'browsers?firefox=20,26&iexplore=!8,-9,10',
    'travis/infernojs/inferno/sauce/Havunen?name=InfernoJS',
    'sauce/Havunen?labels=none'
  ]
    .map(example => ({ example, url: `${endpoint}/${example}` }))
    .map(
      ({ example, url }) =>
        `- [\`${example}\`](${url}) [![example](${url})](${url})`
    )
    .join('\n');

const createComment = async ({ name, stage, tier, body }) => {
  const octokit = await getOctokitClient(name, tier);

  // convert stage name pr7 to the number 7 for the issues API
  const issueNumber = stage.replace('pr', '');

  await octokit.issues.createComment({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: issueNumber,
    body
  });
};

const postPrEnvironmentLink = async ({ name, stage, tier }) => {
  const pipeline = `https://${region}.console.aws.amazon.com/codesuite/codepipeline/pipelines/tf-${name}-${tier}-${stage}/view?region=${region}`;
  const endpoint = `https://${name}-${tier}-${stage}.freetls.fastly.net`;
  const examples = getExamples({ endpoint });
  const body = `
## PR Deployment

Deployed PR environment to \`${endpoint}\`!

**Examples**:

${examples}

**Deployment**: If you are an admin, deploy to production from the [AWS pipeline page](${pipeline}).`;

  await createComment({ name, stage, tier, body });
};

const postDeploymentLink = async ({ name, stage, tier }) => {
  const endpoint = `https://${name}${
    stage === 'production' ? '' : `-${stage}`
  }.${ROOT_DOMAIN}`;
  const examples = getExamples({ endpoint });
  const body = `
## ${firstCaps(stage)} Deployment

Deployed this PR to **\`${stage}\`** at \`${endpoint}\`!

**Examples**:

${examples}`;

  await createComment({ name, stage: PR_STAGE, tier, body });
};

module.exports = {
  postPrEnvironmentLink,
  postDeploymentLink
};
