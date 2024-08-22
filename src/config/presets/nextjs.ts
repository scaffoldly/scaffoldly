import { join } from 'path';
import { PackageJson, ScaffoldlyConfig } from '..';
import { readFileSync } from 'fs';

export class NextJsPreset {
  constructor(private cwd: string) {}

  get config(): Promise<ScaffoldlyConfig> {
    return Promise.all([this.packageJson, this.runtime, this.handler, this.files]).then(
      ([packageJson, runtime, handler, files]) => {
        packageJson.scaffoldly = {
          runtime,
          handler,
          files,
          scripts: {
            dev: packageJson.scripts?.dev,
            build: packageJson.scripts?.build,
            start: packageJson.scripts?.start,
          },
        };
        return new ScaffoldlyConfig({ packageJson });
      },
    );
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

  get files(): Promise<string[]> {
    // TODO infer files from output type
    return Promise.resolve(['.next', 'out', 'public', 'node_modules']);
  }
}
