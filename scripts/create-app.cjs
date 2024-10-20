#!/usr/bin/env node
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(-1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(-1);
});

(async () => {
  const { run } = await import('../dist/create-app.js');
  try {
    await run();
  } catch (e) {
    console.error(`BAD: Uncaught error in create-app script!`);
    console.error(e);
    process.exit(1);
  }
})();
