'use strict';

const AWS = require('aws-sdk');
const config = require('config');
const { memoize } = require('lodash');

const { serviceName, tier } = config.get('env');

const secretsManager = new AWS.SecretsManager();

const getSecret = memoize(async name => {
  const secretId = `tf-${serviceName}-${tier}-${name}`;
  const { SecretString } = await secretsManager
    .getSecretValue({ SecretId: secretId })
    .promise();
  return SecretString;
});

module.exports = { getSecret };
