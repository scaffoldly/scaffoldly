#!/usr/bin/env node
(async () => {
  const { run } = await import('../dist/scaffoldly.js');
  try {
    await run();
  } catch (e) {
    console.error(`BAD: Uncaught error in scaffoldly script!`);
    console.error(e);
    process.exit(1);
  }
})();
