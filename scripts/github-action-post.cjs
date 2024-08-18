#!/usr/bin/env node
(async () => {
  const { run } = await import('../dist/github-action.js');
  try {
    await run('post');
    process.exit(0);
  } catch (e) {
    console.error(`BAD: Uncaught error in post script!`);
    console.error(e);
    process.exit(1);
  }
})();
