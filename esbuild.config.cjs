const esbuild = require('esbuild');

esbuild
  .build({
    entryPoints: ['cli/index.ts'],
    outfile: 'dist/index.js',
    bundle: true,
    minify: true,
    sourcemap: true,
    platform: 'node',
    target: ['node16'],
    external: [],
  })
  .then(() => {
    console.log('Build successful');
  })
  .catch((e) => 'Build failed: ' + e.message);
