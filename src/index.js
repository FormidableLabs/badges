/* eslint-disable global-require */

'use strict';

const PORT = process.env.PORT || 3000;
const HOST = process.env.SERVER_HOST || '0.0.0.0';

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

const app = express();
app.set('etag', true);
app.use(compression());

function handleBrowsersBadge(req, res, browsersList) {
  const query = { style: req.query.style };

  return (
    Promise.resolve(browsersList)
      .then(browsers => {
        if (browsers.length) {
          const options = {
            logos: req.query.logos,
            labels: req.query.labels,
            exclude: req.query.exclude,
            sortBy: req.query.sortBy,
            versionDivider: req.query.versionDivider,
            ...query
          };
          return getBrowsersBadge({ browsers, options });
        }
        return getShieldsBadge('browsers', 'unknown', 'lightgrey', query);
      })
      .catch(err => {
        console.error(`Error: ${err}`);
        return getShieldsBadge('browsers', 'unknown', 'lightgrey', query);
      })
      // eslint-disable-next-line promise/always-return
      .then(body => {
        res.write(body);
        res.end();
      })
  );
}

/**
 * Helper for sending an SVG response given a promise of SauceLabs jobs
 * or a browser-matrix SVG badge to transform. Need this because there are
 * two handlers that have a lot of overlap:
 * - /sauce/:user - Get jobs for any build (regardless of CI service).
 * - /travis/:user/:repo/sauce - Get jobs for a Travis build.
 */
// eslint-disable-next-line max-params
function handleSauceBadge(req, res, client, source, sauceJobs) {
  let browsers;
  if (source === 'svg') {
    browsers = client.getLatestSVGBrowsers();
  } else {
    browsers = Promise.resolve(sauceJobs).then(jobs => {
      const filters = {
        name: req.query.name,
        tag: req.query.tag
      };
      jobs = client.filterJobs(jobs, filters);
      return client.aggregateBrowsers(jobs);
    });
  }
  browsers = browsers.then(getGroupedBrowsers);
  return handleBrowsersBadge(req, res, browsers);
}

const startResponse = res => {
  res.status(200);
  res.set('Content-Type', 'image/svg+xml');
  if (cachingEnabled) {
    res.set('Cache-Control', cacheHeader);
  }
  res.flushHeaders();
};

app.get('/', (req, res) => {
  res.redirect(homePage);
});

// eslint-disable-next-line max-statements,complexity
app.get(
  '/sauce/:user',
  asyncMiddleware(async (req, res) => {
    console.log(`Incoming request from referrer: ${req.get('Referrer')}`);

    const user = req.params.user;
    let source = req.query.source || 'svg';
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
    const jobs = source === 'api' ? sauce.getBuildJobs(build, query) : [];

    // Start response.
    res.status(200);
    res.set('Content-Type', 'image/svg+xml');
    if (cachingEnabled) {
      res.set('Cache-Control', cacheHeader);
    }
    res.flushHeaders();
    return handleSauceBadge(req, res, sauce, source, jobs);
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
  asyncMiddleware(async (req, res) => {
    console.log(`Incoming request from referrer: ${req.get('Referrer')}`);

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
      body = getShieldsBadge(label, status, color, query);
    } catch (err) {
      console.error(`Error: ${err}`);
      body = getShieldsBadge(label, 'error', 'lightgrey', query);
    }

    startResponse(res);
    res.write(body);
    res.end();
  })
);

app.get(
  '/travis/:user/:repo/sauce/:sauceUser?',
  asyncMiddleware(async (req, res) => {
    console.log(`Incoming request from referrer: ${req.get('Referrer')}`);

    const user = req.params.user;
    const repo = req.params.repo;
    const endpoint = res.locals.travisEndpoint || undefined;
    const sauceUser = req.params.sauceUser || user;
    const branch = req.query.branch || 'master';
    const travis = new TravisClient(user, repo, endpoint);

    const accessKey = await getSecret('sauce-access-key');
    const sauce = new SauceClient(sauceUser, accessKey);
    const jobs = await travis.getLatestBranchBuild(branch).then(build => {
      return sauce.getTravisBuildJobs(build);
    });

    startResponse(res);
    return handleSauceBadge(req, res, sauce, 'api', jobs);
  })
);

// eslint-disable-next-line max-statements
app.get('/size/:source/*', (req, res) => {
  console.log(`Incoming request from referrer: ${req.get('Referrer')}`);

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
  // eslint-disable-next-line promise/catch-or-return
  getFileSize(url, options)
    .then(size => {
      return getShieldsBadge(label, size, color, query);
    })
    .catch(err => {
      console.error(`Error: ${err}`);
      return getShieldsBadge(label, 'error', 'lightgrey', query);
    })
    // eslint-disable-next-line promise/always-return
    .then(body => {
      startResponse(res);
      res.write(body);
      res.end();
    });
});

app.get('/browsers', (req, res) => {
  console.log(`Incoming request from referrer: ${req.get('Referrer')}`);

  let browsers = {};
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
  browsers = getGroupedBrowsers(browsers);

  startResponse(res);
  return handleBrowsersBadge(req, res, browsers);
});

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

      // eslint-disable-next-line no-console
      console.log(`Server started at http://${address}:${port}`);
    }
  );
}
