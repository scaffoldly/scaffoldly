#!/usr/bin/env node
(async () => {
  const { run } = await import('./index.js');
  console.log('!!! hello world');
  await run();
})();
