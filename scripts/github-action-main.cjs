#!/usr/bin/env node
(async () => {
  const { run } = await import('../dist/github-action.js');
  try {
    await run('main');
    process.exit(0);
  } catch (e) {
    console.error(`BAD: Uncaught error in github-action-main script!`);
    console.error(e);
    process.exit(1);
  }
})();
