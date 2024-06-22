#!/usr/bin/env node
(async () => {
  const { run } = await import('./awslambda-bootstrap.js');
  await run();
})();
