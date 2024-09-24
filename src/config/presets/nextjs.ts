import { join } from 'path';
import { Mode, PackageJson, PackageJsonBin, ScaffoldlyConfig } from '..';
import { existsSync, readFileSync } from 'fs';
import { isDebug } from '../../scaffoldly/ui';
import { Preset } from '.';
import { GitService } from '../../scaffoldly/commands/cd/git';

export class NextJsPreset extends Preset {
  constructor(gitService: GitService, private mode?: Mode) {
    super(gitService);
  }

  get configPath(): Promise<string> {
    return this.gitService.workDir.then((workDir) => join(workDir, 'package.json'));
  }

  get config(): Promise<ScaffoldlyConfig> {
    return Promise.all([
      this.gitService.baseDir,
      this.gitService.workDir,
      this.packageJson,
      this.packages,
      this.bin,
      this.files,
      this.install,
      this.start,
    ]).then(([baseDir, workDir, packageJson, packages, bin, files, install, start]) => {
      packageJson.scaffoldly = {
        runtime: `node:${process.version.split('v')[1]}-alpine`,
        handler: 'localhost:3000',
        packages,
        bin,
        services: [
          {
            name: 'next',
            files,
            scripts: {
              install,
              dev: packageJson.scripts?.dev,
              build: packageJson.scripts?.build,
              start,
            },
          },
        ],
      };
      if (isDebug()) {
        console.log(`Using NextJS preset config:`, JSON.stringify(packageJson.scaffoldly, null, 2));
      }
      return new ScaffoldlyConfig(baseDir, workDir, { packageJson }, this.mode);
    });
  }

  get packageJson(): Promise<PackageJson> {
    return this.configPath.then((configPath) => {
      try {
        const packageJson = JSON.parse(readFileSync(configPath, 'utf8')) as PackageJson;
        return packageJson;
      } catch (e) {
        throw new Error(`Couldn't find package.json in ${configPath}`, { cause: e });
      }
    });
  }

  get runtime(): Promise<string> {
    return Promise.resolve(`node:${process.version.split('v')[1]}-alpine`);
  }

  get handler(): Promise<string> {
    // TODO infer port from nextjs config
    return Promise.resolve('localhost:3000');
  }

  get nextOutput(): Promise<'export' | 'standalone' | undefined> {
    return this.gitService.workDir.then((workDir) => {
      return import(join(workDir, 'next.config.mjs')).then((config) => {
        return config.default.output;
      });
    });
  }

  get packages(): Promise<string[] | undefined> {
    return this.nextOutput.then((output) => {
      if (output === 'export') {
        return ['npm:serve'];
      }
      return undefined;
    });
  }

  get bin(): Promise<PackageJsonBin | undefined> {
    return this.nextOutput.then((output) => {
      if (output === 'standalone') {
        return { 'server.js': 'next:.next/standalone/server.js' };
      }
      return undefined;
    });
  }

  get files(): Promise<string[]> {
    const files = ['package.json', '.next'];
    return Promise.all([this.nextOutput, this.lockfile, this.public]).then(
      ([output, lockfile, publicDir]) => {
        if (!output) {
          files.push('node_modules');
        }
        if (output === 'export') {
          files.push('out');
        }
        if (lockfile) {
          files.push(lockfile);
        }
        if (publicDir) {
          files.push(publicDir);
        }
        return files;
      },
    );
  }

  get lockfile(): Promise<string | undefined> {
    return this.gitService.workDir.then((workDir) => {
      if (existsSync(join(workDir, 'yarn.lock'))) {
        return Promise.resolve('yarn.lock');
      }
      if (existsSync(join(workDir, 'pnpm-lock.yaml'))) {
        return Promise.resolve('pnpm-lock.yaml');
      }
      if (existsSync(join(workDir, 'package-lock.json'))) {
        return Promise.resolve('package-lock.json');
      }
      return Promise.resolve(undefined);
    });
  }

  get public(): Promise<string | undefined> {
    return this.gitService.workDir.then((workDir) => {
      if (existsSync(join(workDir, 'public'))) {
        return Promise.resolve('public');
      }
      return Promise.resolve(undefined);
    });
  }

  get install(): Promise<string> {
    return this.lockfile.then((lockfile) => {
      if (lockfile === 'yarn.lock') {
        return 'yarn install --frozen-lockfile';
      }
      if (lockfile === 'pnpm-lock.yaml') {
        return 'pnpm install --frozen-lockfile';
      }
      return 'npm ci';
    });
  }

  get start(): Promise<string | undefined> {
    return Promise.all([this.packageJson, this.nextOutput]).then(([packageJson, output]) => {
      if (output === 'export') {
        return 'serve out';
      }
      if (output === 'standalone') {
        return 'node server.js';
      }
      return packageJson.scripts?.start;
    });
  }
}
