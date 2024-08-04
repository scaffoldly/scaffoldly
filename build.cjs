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

const configureTypescript = async () => {
  const ts = await import('typescript');
  const tsConfigPath = path.join(__dirname, 'tsconfig.json');
  const { config, error } = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  if (error) {
    console.error(ts.formatDiagnosticsWithColorAndContext([err], ts.createCompilerHost(options)));
    process.exit(1);
  }

  const { options, errors } = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    path.dirname(tsConfigPath),
  );
  if (errors.length > 0) {
    errors.forEach((err) =>
      console.error(ts.formatDiagnosticsWithColorAndContext([err], ts.createCompilerHost(options))),
    );
    process.exit(1);
  }

  options.noEmit = true;
  options.tsBuildInfoFile = path.join(__dirname, 'build', 'tsconfig.tsbuildinfo');

  return { ts, tsOptions: options };
};

const typeCheck = async (entrypoints, ts, tsOptions) => {
  const program = ts.createProgram(entrypoints, tsOptions);
  const emitResult = program.emit();
  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

  if (allDiagnostics.length > 0) {
    allDiagnostics.forEach((diagnostic) => {
      if (diagnostic.file) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        console.error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}\n`);
      } else {
        console.error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      }
    });
    throw new Error('Type checking failed');
  }
};

const build = async (ts, tsOptions) => {
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
      logLevel: 'info',
      plugins: [
        {
          name: 'tsc',
          setup: async (build) => {
            await typeCheck(build.initialOptions.entryPoints, ts, tsOptions);
          },
        },
      ],
    });
  } catch (error) {
    console.error('Build failed:', error.message);
  }
};

const watch = async (ts, tsOptions) => {
  if (process.argv.includes('--watch')) {
    const chokidar = await import('chokidar');
    console.log('Watching for changes...');
    chokidar
      .watch(['package.json', 'src/**/*.{ts,js}'], { ignoreInitial: true })
      .on('all', (event, path) => {
        console.log(`${event} detected at ${path}. Rebuilding...`);
        build(ts, tsOptions);
      });
  }
};

if (require.main === module) {
  (async () => {
    try {
      const { ts, tsOptions } = await configureTypescript();
      build(ts, tsOptions);
      watch(ts, tsOptions);
    } catch (e) {
      console.error(e);
      process.exit(-1);
    }
  })();
}
