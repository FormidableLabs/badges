'use strict';

const util = require('util');

function prettyPrint(obj, options = {}) {
  return util.inspect(obj, {
    breakLength: 120,
    colors: true,
    ...options
  });
}

module.exports = { prettyPrint };
