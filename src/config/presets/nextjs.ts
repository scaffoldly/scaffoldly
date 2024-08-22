import { join } from 'path';
import { PackageJson, PackageJsonBin, ScaffoldlyConfig } from '..';
import { existsSync, readFileSync } from 'fs';
import { isDebug } from '../../scaffoldly/ui';

export class NextJsPreset {
  constructor(private cwd: string) {}

  get config(): Promise<ScaffoldlyConfig> {
    return Promise.all([
      this.packageJson,
      this.packages,
      this.bin,
      this.files,
      this.install,
      this.start,
    ]).then(([packageJson, packages, bin, files, install, start]) => {
      packageJson.scaffoldly = {
        runtime: `node:${process.version.split('v')[1]}-alpine`,
        handler: 'localhost:3000',
        buildFiles: ['!node_modules'],
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
      return new ScaffoldlyConfig({ packageJson });
    });
  }

  get packageJson(): Promise<PackageJson> {
    try {
      const packageJson = JSON.parse(
        readFileSync(join(this.cwd, 'package.json'), 'utf8'),
      ) as PackageJson;
      return Promise.resolve(packageJson);
    } catch (e) {
      throw new Error(`Couldn't find package.json in ${this.cwd}`, { cause: e });
    }
  }

  get runtime(): Promise<string> {
    return Promise.resolve(`node:${process.version.split('v')[1]}-alpine`);
  }

  get handler(): Promise<string> {
    // TODO infer port from nextjs config
    return Promise.resolve('localhost:3000');
  }

  get nextOutput(): Promise<'export' | 'standalone' | undefined> {
    return import(join(this.cwd, 'next.config.mjs')).then((config) => {
      return config.default.output;
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
    const files = ['package.json', '.next', 'public'];
    return Promise.all([this.nextOutput, this.lockfile]).then(([output, lockfile]) => {
      if (!output) {
        files.push('node_modules');
      }
      if (output === 'export') {
        files.push('out');
      }
      if (lockfile) {
        files.push(lockfile);
      }
      return files;
    });
  }

  get lockfile(): Promise<string | undefined> {
    if (existsSync(join(this.cwd, 'yarn.lock'))) {
      return Promise.resolve('yarn.lock');
    }
    if (existsSync(join(this.cwd, 'pnpm-lock.yaml'))) {
      return Promise.resolve('pnpm-lock.yaml');
    }
    if (existsSync(join(this.cwd, 'package-lock.json'))) {
      return Promise.resolve('package-lock.json');
    }
    return Promise.resolve(undefined);
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
