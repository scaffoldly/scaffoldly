#!/usr/bin/env node
const tsup = require('tsup');
const path = require('path');
const { exec: pkg } = require('pkg');

const outDir = 'dist';
const nativeEntries = ['src/scaffoldly.ts', 'src/awslambda-entrypoint.ts'];
const entry = [...nativeEntries, 'src/github-action.ts', 'src/create-app.ts', 'src/index.ts'];

if (require.main === module) {
  (async () => {
    await tsup
      .build({
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
      })
      .then((build) => {
        if (!process.argv.includes('--native')) {
          return Promise.resolve();
        }
        const builds = ['x86_64', 'aarch64']
          .map((arch) => {
            console.log(`Building for ${arch}`);
            let target = `linuxstatic-x64`;
            if (arch === 'aarch64') {
              target = `linuxstatic-arm64`;
            }
            const args = nativeEntries.map((entry) => {
              return [
                entry.replace('src/', `${outDir}/`).replace('.ts', '.js'),
                '--target',
                target,
                '--output',
                path.join(outDir, `${path.basename(entry, '.ts')}-${arch}`),
                '--compress',
                'Brotli',
                '--build',
              ];
            });

            return args;
          })
          .flat();

        return Promise.all(
          builds.map(async (args) => {
            console.log(`Native packaging with args: ${args.join(' ')}`);
            await pkg(args);
          }),
        );
      });
  })();
}
