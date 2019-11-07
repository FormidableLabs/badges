'use strict';

const AWS = require('aws-sdk');
const { filter, flatMap, flow, map } = require('lodash/fp');

const codepipeline = new AWS.CodePipeline();

module.exports = async ({ name, tier, stage }) => {
  const pipelineName = `tf-${name}-${tier}-${stage}`;

  let pipelineState;
  try {
    pipelineState = await codepipeline
      .getPipelineState({
        name: pipelineName
      })
      .promise();
  } catch (err) {
    if (err.code === 'PipelineNotFoundException') {
      console.warn('Pipeline does not exist yet, skipping.');
      return;
    }
  }

  await Promise.all(
    flow(
      filter({
        actionStates: [
          {
            latestExecution: { status: 'InProgress' }
          }
        ]
      }),
      flatMap(({ stageName, actionStates }) =>
        actionStates.map(
          ({ actionName, latestExecution }) =>
            latestExecution.token && {
              pipelineName,
              stageName,
              actionName,
              token: latestExecution.token,
              result: {
                status: 'Rejected',
                summary: 'This build artifact is out of date.'
              }
            }
        )
      ),
      filter(Boolean),
      map(params => codepipeline.putApprovalResult(params).promise())
    )(pipelineState.stageStates)
  );
};
