#!/usr/bin/env node
(async () => {
  const { run } = await import('../dist/scaffoldly.js');
  try {
    await run();
    process.exit(0);
  } catch (e) {
    console.error(`BAD: Uncaught error in scaffoldly script!`);
    console.error(e);
    process.exit(1);
  }
})();
