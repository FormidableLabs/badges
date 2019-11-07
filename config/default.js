'use strict';

module.exports = {
  env: {
    serviceName: 'badges',
    tier: 'nonprod',
    stage: 'sandbox'
  },
  sauce: {
    user: 'FormidableLabs'
  },
  caching: {
    enabled: true,
    browserMaxAge: 30, // 30 seconds
    cdnMaxAge: 900, // 15 minutes
    staleWhileRevalidate: 30, // 30 seconds
    staleIfError: 900 // 15 minutes
  }
};
