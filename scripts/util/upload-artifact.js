'use strict';

const AWS = require('aws-sdk');
const archiver = require('archiver');

const sts = new AWS.STS();
const s3 = new AWS.S3();

// eslint-disable-next-line max-statements
module.exports = async ({ name, tier, stage }) => {
  const { Account: accountId } = await sts.getCallerIdentity({}).promise();

  const bucketName = `tf-${name}-${tier}-artifacts-${accountId}`;
  const archiveKey = `artifact-${name}-${tier}-${stage}.zip`;

  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  archive.on('warning', err => {
    if (err.code === 'ENOENT') {
      console.warn(err);
    } else {
      throw err;
    }
  });

  archive.on('error', err => {
    throw err;
  });

  archive.directory('scripts');
  archive.glob('terraform/**/*.{tf,hcl}');
  archive.file('.terraform-version');
  archive.file('serverless-artifact.zip');
  archive.file('buildspec.cd.yml', { name: 'buildspec.yml' });
  archive.file('serverless.yml');
  archive.file('package.json');
  archive.file('yarn.lock');

  archive.finalize();

  await s3
    .upload({
      Bucket: bucketName,
      Key: archiveKey,
      Body: archive
    })
    .promise();
};
