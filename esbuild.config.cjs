const esbuild = require('esbuild');

esbuild
  .build({
    entryPoints: ['cli/index.ts'],
    outfile: 'dist/index.js',
    bundle: true,
    sourcemap: true,
    platform: 'node',
    target: ['node16'],
    external: [],
  })
  .then(() => {})
  .catch((e) => console.log('[scaffoldly] Build failed: ' + e.message));
