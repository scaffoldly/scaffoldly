#!/usr/bin/env node
(async () => {
  const { run } = await import('../dist/github-action.js');
  try {
    await run('post');
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
})();
