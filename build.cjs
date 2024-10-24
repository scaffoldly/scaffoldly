#!/usr/bin/env node
const tsup = require('tsup');
const fs = require('fs');
const path = require('path');
// const { execSync } = require('child_process');
// const { esbuildPluginTsc } = require('esbuild-plugin-tsc');
// const { dtsPlugin } = require('esbuild-plugin-d.ts');

// if (fs.existsSync(path.join(__dirname, '..', '.git'))) {
//   try {
//     console.log("Activating Husky's Git hooks...");
//     execSync(path.join(__dirname, 'node_modules', '.bin', 'husky'), { stdio: 'inherit' });
//   } catch (e) {
//     console.warn('Failed to activate Husky Git hooks:', e.message);
//   }
// }

// const lint = async (entrypoints) => {
//   const { ESLint } = await import('eslint');
//   const eslint = new ESLint();
//   const results = await eslint.lintFiles(['src/**/*.ts']);
//   const formatter = await eslint.loadFormatter('stylish');
//   const resultText = formatter.format(results);

//   console.log(resultText);

//   const hasWarningsOrErrors = results.some(
//     (result) => result.warningCount > 0 || result.errorCount > 0,
//   );
//   if (hasWarningsOrErrors) {
//     console.warn('Linting completed with warnings or errors.');
//   }
// };

// const configureTypescript = async () => {
//   const ts = await import('typescript');
//   const tsConfigPath = path.join(__dirname, 'tsconfig.json');
//   const { config, error } = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
//   if (error) {
//     console.error(ts.formatDiagnosticsWithColorAndContext([err], ts.createCompilerHost(options)));
//     process.exit(1);
//   }

//   const { options, errors } = ts.parseJsonConfigFileContent(
//     config,
//     ts.sys,
//     path.dirname(tsConfigPath),
//   );
//   if (errors.length > 0) {
//     errors.forEach((err) =>
//       console.error(ts.formatDiagnosticsWithColorAndContext([err], ts.createCompilerHost(options))),
//     );
//     process.exit(1);
//   }

//   options.noEmit = true;
//   options.noEmitOnError = true;
//   options.strict = false;
//   options.tsBuildInfoFile = path.join(__dirname, 'build', 'tsconfig.tsbuildinfo');

//   return { ts, tsOptions: options };
// };

// const typeCheck = async (entrypoints, ts, tsOptions) => {
//   const program = ts.createProgram(entrypoints, tsOptions);
//   const emitResult = program.emit();
//   const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

//   if (allDiagnostics.length > 0) {
//     allDiagnostics.forEach((diagnostic) => {
//       if (diagnostic.file) {
//         const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
//         const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
//         console.error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}\n`);
//       } else {
//         console.error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
//       }
//     });
//     throw new Error('Type checking failed');
//   }
// };

// const build = async (ts, tsOptions) => {
//   const esbuild = await import('esbuild');
//   try {
//     await esbuild.build({
//       entryPoints: [
//         'src/scaffoldly.ts',
//         'src/github-action.ts',
//         'src/awslambda-entrypoint.ts',
//         'src/create-app.ts',
//         'src/index.ts',
//       ],
//       bundle: true,
//       outdir: 'dist',
//       minify: false,
//       sourcemap: false,
//       platform: 'node',
//       target: ['node18'],
//       resolveExtensions: ['.ts', '.js', '.json'],
//       external: [
//         '*.node', // This line tells esbuild to treat .node files as external
//       ],
//       loader: {
//         '.node': 'file', // TODO: This is a hack to prevent esbuild from trying to bundle .node files,
//         '.md': 'text',
//       },
//       logLevel: 'info',
//       plugins: [
//         dtsPlugin({
//           outDir: 'dist',
//         }),
//         {
//           name: 'lint',
//           setup: async (build) => {
//             // await lint(build.initialOptions.entryPoints);
//             // await typeCheck(build.initialOptions.entryPoints, ts, tsOptions);
//           },
//         },
//       ],
//     });
//   } catch (error) {
//     console.error('Build failed:', error.message);
//   }
// };

// const watch = async (ts, tsOptions) => {
//   if (process.argv.includes('--watch')) {
//     const chokidar = await import('chokidar');
//     console.log('Watching for changes...');
//     chokidar
//       .watch(['package.json', 'src/**/*.{ts,js}'], { ignoreInitial: true })
//       .on('all', (event, path) => {
//         console.log(`${event} detected at ${path}. Rebuilding...`);
//         build(ts, tsOptions);
//       });
//   }
// };

if (require.main === module) {
  (async () => {
    await tsup.build({
      entry: [
        'src/scaffoldly.ts',
        'src/github-action.ts',
        'src/awslambda-entrypoint.ts',
        'src/create-app.ts',
        'src/index.ts',
      ],
      bundle: true,
      outDir: 'dist',
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
    // try {
    //   const { ts, tsOptions } = await configureTypescript();
    //   await build(ts, tsOptions);
    //   watch(ts, tsOptions);
    // } catch (e) {
    //   console.error(e);
    //   process.exit(-1);
    // }
  })();
}
