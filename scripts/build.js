'use strict';

const marko = require('marko');

const main = async () => {
  marko.load(require.resolve('../src/browsers.svg'), { writeToDisk: true });
};

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  });
}
