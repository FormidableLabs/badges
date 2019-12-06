'use strict';

const PORT = process.env.PORT || 3000;
const HOST = process.env.SERVER_HOST || '0.0.0.0';

const { basename } = require('path');
const log = require('debug')(`badges:${basename(__filename)}`);
const _ = require('lodash');
const config = require('config');
const express = require('express');
const compression = require('compression');

const { asyncMiddleware } = require('./middleware');
const {
  TravisClient,
  TRAVIS_COM_ENDPOINT,
  TRAVIS_ORG_ENDPOINT
} = require('./travis');
const { SauceClient } = require('./sauce');
const { getSecret } = require('./secrets');
const { getShieldsBadge } = require('./shields');
const {
  getBrowsersBadge,
  BROWSERS,
  getGroupedBrowsers
} = require('./browsers');
const { getFileSize } = require('./size');

const {
  enabled: cachingEnabled,
  browserMaxAge,
  cdnMaxAge,
  staleWhileRevalidate,
  staleIfError
} = config.get('caching');
const { homePage } = config.get('service');

const cacheHeader =
  cachingEnabled &&
  `public, must-revalidate, max-age=${browserMaxAge}, s-maxage=${cdnMaxAge}, stale-while-revalidate=${staleWhileRevalidate}, stale-if-error=${staleIfError}`;

// ============================================================================
// Helpers
// ============================================================================
// Complete response body for a browsers badge.
const getBrowsersBadgeBody = async ({ req, getBrowsers }) => {
  const query = { style: req.query.style };
  const options = {
    logos: req.query.logos,
    labels: req.query.labels,
    exclude: req.query.exclude,
    sortBy: req.query.sortBy,
    versionDivider: req.query.versionDivider,
    ...query
  };

  let browsers;
  try {
    browsers = await Promise.resolve(getBrowsers);
    if (browsers.length) {
      return getBrowsersBadge({ browsers, options });
    }
  } catch (err) {
    console.error(`Error: ${err}`);
  }

  return getShieldsBadge('browsers', 'unknown', 'lightgrey', query);
};

/**
 * Helper for sending an SVG response given a promise of SauceLabs jobs
 * or a browser-matrix SVG badge to transform. Need this because there are
 * two handlers that have a lot of overlap:
 * - /sauce/:user - Get jobs for any build (regardless of CI service).
 * - /travis/:user/:repo/sauce - Get jobs for a Travis build.
 */
const getSauceBadgeBody = ({ req, sauce, source, sauceJobs }) => {
  let getBrowsers;
  if (source === 'svg') {
    getBrowsers = sauce.getLatestSVGBrowsers();
  } else {
    getBrowsers = Promise.resolve(sauceJobs).then(jobs => {
      const filters = {
        name: req.query.name,
        tag: req.query.tag
      };
      jobs = sauce.filterJobs(jobs, filters);
      return sauce.aggregateBrowsers(jobs);
    });
  }
  getBrowsers = getBrowsers.then(getGroupedBrowsers);

  return getBrowsersBadgeBody({ req, getBrowsers });
};

// Common response wrapper
const sendResponse = ({ res, body }) => {
  res.status(200);
  res.set('Content-Type', 'image/svg+xml');
  if (cachingEnabled) {
    res.set('Cache-Control', cacheHeader);
  }
  res.flushHeaders();
  res.write(body);
  res.end();
};

// ============================================================================
// Server
// ============================================================================
const app = express();
app.set('etag', true);
app.use(compression());
app.get('/', (req, res) => {
  res.redirect(homePage);
});

app.get(
  '/sauce/:user',
  // eslint-disable-next-line max-statements,complexity
  asyncMiddleware(async (req, res) => {
    const user = req.params.user;
    const build = req.query.build; // If undefined, will try to get the latest.

    const query = {};
    if (req.query.from) {
      query.from = parseInt(req.query.from, 10) || void 0;
    }
    if (req.query.to) {
      query.to = parseInt(req.query.to, 10) || void 0;
    }
    if (req.query.skip) {
      query.skip = parseInt(req.query.skip, 10) || void 0;
    }

    let source = req.query.source || 'svg';
    if (
      build ||
      req.query.name ||
      req.query.tag ||
      req.query.from ||
      req.query.to ||
      req.query.skip
    ) {
      source = 'api';
    }

    const accessKey = await getSecret('sauce-access-key');
    const sauce = new SauceClient(user, accessKey);
    const sauceJobs = source === 'api' ? sauce.getBuildJobs(build, query) : [];
    const body = await getSauceBadgeBody({ req, sauce, source, sauceJobs });

    sendResponse({ res, body });
  })
);

// Rewrite `/travis.com` and `/travis.org` URLs to `/travis` while setting
// `res.locals.travisEndpoint`.
app.get('/travis.com/*', (req, res, next) => {
  req.url = `/travis/${req.params[0]}`;
  res.locals.travisEndpoint = TRAVIS_COM_ENDPOINT;
  next();
});

app.get('/travis.org/*', (req, res, next) => {
  req.url = `/travis/${req.params[0]}`;
  res.locals.travisEndpoint = TRAVIS_ORG_ENDPOINT;
  next();
});

app.get(
  '/travis/:user/:repo',
  // eslint-disable-next-line max-statements
  asyncMiddleware(async (req, res) => {
    const user = req.params.user;
    const repo = req.params.repo;
    const endpoint = res.locals.travisEndpoint || undefined;
    const branch = req.query.branch || 'master';
    const label = req.query.label || req.params.repo;
    const travis = new TravisClient(user, repo, endpoint);
    const query = { style: req.query.style };

    const build = await travis.getLatestBranchBuild(branch);
    const filters = {
      env: req.query.env
    };
    const jobs = travis.filterJobs(build.jobs, filters);
    const status = travis.aggregateStatus(jobs);
    const color =
      {
        passed: 'brightgreen',
        failed: 'red'
      }[status] || 'lightgrey';

    let body;
    try {
      body = await getShieldsBadge(label, status, color, query);
    } catch (err) {
      console.error(`Error: ${err}`);
      body = await getShieldsBadge(label, 'error', 'lightgrey', query);
    }

    sendResponse({ res, body });
  })
);

app.get(
  '/travis/:user/:repo/sauce/:sauceUser?',
  asyncMiddleware(async (req, res) => {
    const { user, repo } = req.params;
    const endpoint = res.locals.travisEndpoint || undefined;
    const sauceUser = req.params.sauceUser || user;
    const branch = req.query.branch || 'master';

    const travis = new TravisClient(user, repo, endpoint);
    const [accessKey, build] = await Promise.all([
      getSecret('sauce-access-key'),
      travis.getLatestBranchBuild(branch)
    ]);

    const sauce = new SauceClient(sauceUser, accessKey);
    const sauceJobs = await sauce.getTravisBuildJobs(build);
    const body = await getSauceBadgeBody({
      req,
      sauce,
      source: 'api',
      sauceJobs
    });

    sendResponse({ res, body });
  })
);

// eslint-disable-next-line max-statements
app.get(
  '/size/:source/*',
  asyncMiddleware(async (req, res) => {
    const source = req.params.source;
    const path = req.params[0];
    const color = req.query.color || 'brightgreen';
    const options = { gzip: req.query.gzip === 'true' };
    const query = { style: req.query.style };
    let url;
    // Express' path-to-regexp business is too insane to easily do this above.
    if (path.length > 0) {
      if (source === 'github') {
        url = `https://raw.githubusercontent.com/${path}`;
      } else if (source === 'npm') {
        url = `https://unpkg.com/${path}`;
      }
    }
    const label = req.query.label || (options.gzip ? 'size (gzip)' : 'size');

    const body = await getFileSize(url, options)
      .then(size => getShieldsBadge(label, size, color, query))
      .catch(err => {
        console.error(`Error: ${err}`);
        return getShieldsBadge(label, 'error', 'lightgrey', query);
      });

    sendResponse({ res, body });
  })
);

app.get(
  '/browsers',
  asyncMiddleware(async (req, res) => {
    const browsers = {};
    _.forEach(BROWSERS, (value, browser) => {
      const versionNumbers = (req.query[browser] || '').split(',');
      // eslint-disable-next-line no-shadow
      versionNumbers.reduce((browsers, version) => {
        if (!version) {
          return browsers;
        }
        let status = {
          '!': 'error',
          '-': 'failed',
          '+': 'passed'
        }[version.charAt(0)];
        if (status) {
          version = version.slice(1);
        } else {
          status = 'passed';
        }
        const versions = (browsers[browser] = browsers[browser] || {});
        const browserData = (versions[version] = versions[version] || {
          browser,
          version,
          status: 'unknown'
        });
        browserData.status = status;
        return browsers;
      }, browsers);
    });

    const getBrowsers = getGroupedBrowsers(browsers);
    const body = await getBrowsersBadgeBody({ req, getBrowsers });

    sendResponse({ res, body });
  })
);

// ============================================================================
// Execution
// ============================================================================
// LAMBDA: Export handler for lambda use.
let handler;
module.exports.handler = (event, context, callback) => {
  // Lazy require `serverless-http` to allow non-Lambda targets to omit.
  // eslint-disable-next-line global-require
  handler = handler || require('serverless-http')(app);
  return handler(event, context, callback);
};

// DOCKER/DEV/ANYTHING: Start the server directly.
if (require.main === module) {
  const server = app.listen(
    {
      port: PORT,
      host: HOST
    },
    () => {
      const { address, port } = server.address();

      log(`Server started at http://${address}:${port}`);
    }
  );
}
