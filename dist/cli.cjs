#!/usr/bin/env node
(async () => {
  const { run } = await import('./index.js');
  await run();
})();
