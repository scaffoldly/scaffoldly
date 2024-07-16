#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (fs.existsSync(path.join(__dirname, '.git'))) {
  try {
    console.log("Activating Husky's Git hooks...");
    execSync(path.join(__dirname, 'node_modules', '.bin', 'husky'), { stdio: 'inherit' });
  } catch (e) {
    console.warn('Failed to activate Husky Git hooks:', e.message);
  }
}

const build = async () => {
  const esbuild = await import('esbuild');
  try {
    await esbuild.build({
      entryPoints: ['src/scaffoldly.ts', 'src/awslambda-entrypoint.ts'],
      bundle: true,
      outdir: 'dist',
      minify: true,
      sourcemap: true,
      platform: 'node',
      target: ['node18'],
      external: [],
      loader: {
        '.node': 'file', // TODO: This is a hack to prevent esbuild from trying to bundle .node files
      },
      logLevel: 'debug',
    });
  } catch (error) {
    console.error('Build failed:', error);
  }
};

const watch = async () => {
  if (process.argv.includes('--watch')) {
    const chokidar = await import('chokidar');
    console.log('Watching for changes...');
    chokidar.watch('src/**/*.{ts,js}', { ignoreInitial: true }).on('all', (event, path) => {
      console.log(`${event} detected at ${path}. Rebuilding...`);
      build();
    });
  }
};

// Initial build
build();
watch();
