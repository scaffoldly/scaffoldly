#!/usr/bin/env node

(async () => {
  const { run } = await import('../dist/github-action.js');
  try {
    await run('main');
  } catch (e) {
    console.error(`BAD: Uncaught error in main script!`);
    console.error(e);
    process.exit(1);
  }
})();
