#!/usr/bin/env node
const tsup = require('tsup');
const path = require('path');
const { exec: pkg } = require('pkg');

const outDir = 'dist';
const nativeEntries = ['src/scaffoldly.ts', 'src/awslambda-entrypoint.ts'];
const entry = [...nativeEntries, 'src/github-action.ts', 'src/create-app.ts', 'src/index.ts'];

if (require.main === module) {
  (async () => {
    await tsup.build({
      entry: entry,
      bundle: true,
      outDir: outDir,
      minify: true,
      sourcemap: 'inline',
      dts: true,
      platform: 'node',
      target: 'node18',
      watch: process.argv.includes('--watch'),
      loader: {
        '.md': 'text',
      },
      external: ['*.node'],
    });
  })();
}
