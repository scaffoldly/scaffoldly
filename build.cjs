#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (fs.existsSync(path.join(__dirname, '.git'))) {
  console.log("Activating Husky's Git hooks...");
  execSync(path.join(__dirname, 'node_modules', '.bin', 'husky'), { stdio: 'inherit' });
}

const build = async () => {
  const esbuild = await import('esbuild');
  try {
    await esbuild.build({
      entryPoints: ['src/scaffoldly.ts', 'src/awslambda-bootstrap.ts'],
      bundle: true,
      outdir: 'dist',
      minify: true,
      sourcemap: true,
      platform: 'node',
      target: ['node18'],
      external: [],
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
