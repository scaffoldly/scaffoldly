#!/usr/bin/env node
(async () => {
  const { run } = await import('./scaffoldly.js');
  await run();
})();
