'use strict';

const { cachedRequest, ONE_DAY } = require('./cached-request');

function escapeBadge(str) {
  return str.replace(/-/g, '--').replace(/_/g, '__');
}

// eslint-disable-next-line max-params
function getShieldsBadge(label, status, color, query) {
  const badge = encodeURIComponent(
    [escapeBadge(label), escapeBadge(status), color].join('-')
  );
  const url = `https://img.shields.io/badge/${badge}.svg`;
  return cachedRequest(url, { qs: query, gzip: true }, 5 * ONE_DAY);
}

module.exports = { getShieldsBadge };
