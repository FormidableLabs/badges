'use strict';

/**
 * Error handling for async routes.
 */
const asyncMiddleware = route => (...args) => {
  // `next` is the last arg.
  const next = args[args.length - 1];

  // Manually wrap with an error catcher.
  try {
    // eslint-disable-next-line promise/no-callback-in-promise
    return route(...args).catch(err => next(err));
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  asyncMiddleware
};
