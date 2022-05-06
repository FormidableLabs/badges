'use strict';

const execa = require('execa');

const { SERVICE_NAME, TIER, STAGE } = process.env;

const execaOpts = {
  stdio: 'inherit',
  env: {
    SERVICE_NAME,
    TIER,
    STAGE,
    // Provide `sls package` with the existing build artifact
    // to prevent it from repackaging
    SLS_ARTIFACT: `serverless-artifact.zip`
  }
};

const main = async () => {
  if (!SERVICE_NAME) {
    throw new Error('Service name not provided.');
  }
  if (!TIER) {
    throw new Error('Tier not provided.');
  }
  if (!STAGE) {
    throw new Error('Stage not provided.');
  }

  // Prepare the Serverless artifact for deploy.
  // Note: this "package" command doesn't actually repackage the code artifact.
  // It just regenerates the Serverless CloudFormation templates so that
  // they point to production instead of the PR environment.
  await execa.command('yarn sls package', execaOpts);

  // Deploy the promoted artifact.
  await execa('yarn', ['sls', 'deploy', '--package', '.serverless'], execaOpts);

  // Apply any corresponding Terraform for this stage.
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
};

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  });
}
