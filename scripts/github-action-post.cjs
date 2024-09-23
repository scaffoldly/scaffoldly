#!/usr/bin/env node

(async () => {
  const { run } = await import('../dist/github-action.js');
  const { version } = require('../package.json');
  try {
    await run('post', version);
  } catch (e) {
    console.error(`BAD: Uncaught error in post script!`);
    console.error(e);
    process.exit(1);
  }
})();
