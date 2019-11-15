'use strict';

const path = require('path');
const log = require('debug')(`badges:${path.basename(__filename)}`);
const request = require('request');
const gzipSize = require('gzip-size');
const { prettyPrint } = require('./util');

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;

// eslint-disable-next-line valid-jsdoc
/**
 * Request `url` with `options` and return a promise that will resolve to the
 * response body (or the headers, if `options.method` is 'HEAD'). `options` are
 * passed along to the `request` library. If `customTTL` is specified, it can
 * be a number or function that returns a different cache `maxAge` than the
 * default. This is useful for deciding that responses containing
 * fresh/in-progress results should have a lower TTL, and responses containing
 * old/complete results a higher TTL.
 */
// eslint-disable-next-line max-statements
function cachedRequest(url, options) {
  const method = options.method || 'GET';
  const resolveHeaders = method === 'HEAD';

  // eslint-disable-next-line promise/avoid-new
  const promise = new Promise((resolve, reject) => {
    const { size = false, ...requestOptions } = options;
    const gzip = options.gzip || false;
    let responseDataSize = 0;
    // eslint-disable-next-line max-statements
    request({ ...requestOptions, url }, (err, response, body) => {
      if (err) {
        reject(err);
      } else if (response.statusCode >= 400) {
        err = new Error(`HTTP ${response.statusCode}`);
        err.response = response;
        reject(err);
      } else if (size) {
        const isGzipResponse = response.headers['content-encoding'] === 'gzip';
        if (gzip === isGzipResponse && response.headers['content-length']) {
          log('Size request: returning Content-Length.');
          resolve(parseInt(response.headers['content-length'], 10));
        } else if (method === 'HEAD') {
          log(
            'Size request made with HEAD, but no Content-Length: returning null.'
          );
          resolve(null);
        } else if (gzip) {
          if (isGzipResponse) {
            log('Size request received gzip: returning raw response size.');
            resolve(responseDataSize);
          } else {
            log('Size request received uncompressed data: running gzip.');
            resolve(gzipSize(body));
          }
        } else {
          log('Size request: returning body length.');
          resolve(body.length);
        }
      } else if (resolveHeaders) {
        resolve(response.headers);
      } else {
        resolve(body);
      }
    }).on('response', response => {
      response.on('data', data => {
        responseDataSize += data.length;
      });
    });
  });

  // Return the original promise and not the one from this `catch`; otherwise
  // downstream consumers will never know there was an error (unless we rethrow
  // here, gross).
  promise.catch(err => {
    // Remove this rejected promise from the cache so that a new request for
    // `url` can be made immediately.
    if (err.response) {
      console.error(prettyPrint(err.response.headers));
      console.error(prettyPrint(err.response.body));
    } else {
      console.error(prettyPrint(err));
    }
  });
  return promise;
}

module.exports = {
  cachedRequest,
  ONE_MINUTE,
  ONE_HOUR,
  ONE_DAY
};
