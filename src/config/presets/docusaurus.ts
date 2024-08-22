import { join } from 'path';
import { PackageJson, ScaffoldlyConfig } from '..';
import { existsSync, readFileSync } from 'fs';

export class DocusaurusPreset {
  constructor(private cwd: string) {}

  get config(): Promise<ScaffoldlyConfig> {
    return Promise.all([
      this.packageJson,
      this.runtime,
      this.handler,
      this.packages,
      this.buildFiles,
      this.docusaurusRuntime,
      this.docusaurusFiles,
      this.docusaurusInstallScript,
    ]).then(
      ([
        packageJson,
        runtime,
        handler,
        packages,
        buildFiles,
        docusaurusRuntime,
        docusaurusFiles,
        docusaurusInstallScript,
      ]) => {
        packageJson.scaffoldly = {
          runtime,
          handler,
          packages,
          buildFiles,
          services: [
            {
              name: 'docusaurus',
              runtime: docusaurusRuntime,
              files: docusaurusFiles,
              scripts: {
                install: docusaurusInstallScript,
                build: packageJson.scripts?.build,
                start: 'serve build',
              },
            },
          ],
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
    return Promise.resolve('alpine:3');
  }

  get handler(): Promise<string> {
    // TODO infer port from docusaurus config
    return Promise.resolve('localhost:3000');
  }

  get packages(): Promise<string[]> {
    return Promise.resolve(['npm', 'npm:serve@14']);
  }

  get buildFiles(): Promise<string[]> {
    return Promise.resolve(['!node_modules', '!package-lock.json']);
  }

  get docusaurusFiles(): Promise<string[]> {
    // TODO infer files from output type
    return Promise.resolve(['package.json', 'build']);
  }

  get docusaurusRuntime(): Promise<string> {
    // TODO Infer node js version from host
    return Promise.resolve(`node:${process.version.split('v')[1]}-alpine`);
  }

  get docusaurusInstallScript(): Promise<string> {
    if (existsSync(join(this.cwd, 'yarn.lock'))) {
      return Promise.resolve('yarn');
    }
    if (existsSync(join(this.cwd, 'pnpm-lock.yaml'))) {
      return Promise.resolve('pnpm install');
    }
    return Promise.resolve('npm install');
  }
}
