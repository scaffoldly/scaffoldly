#!/usr/bin/env node
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(-1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(-1);
});

(async () => {
  const { run } = await import('../dist/scaffoldly.js');
  const { version } = require('../package.json');
  try {
    await run(version);
  } catch (e) {
    console.error(`BAD: Uncaught error in scaffoldly script!`);
    console.error(e);
    process.exit(1);
  }
})();
