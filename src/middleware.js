'use strict';

const interceptor = require('express-interceptor');
const SVGO = require('svgo');

/**
 * SVGO middleware: optimize any SVG response.
 */
module.exports = function svgoMiddleware(options) {
  const svgo = new SVGO(options);
  return interceptor((req, res) => {
    return {
      isInterceptable() {
        return /image\/svg\+xml(;|$)/.test(res.get('content-type'));
      },
      intercept(body, send) {
        if (body) {
          svgo.optimize(body, result => {
            send(result.data);
          });
        } else {
          send(body);
        }
      }
    };
  });
};
