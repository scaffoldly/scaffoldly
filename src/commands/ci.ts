import { join } from 'path';
import { ScaffoldlyConfig } from './config';
import { DockerService } from './docker';
import { readFileSync } from 'fs';

export type PackageJson = {
  name?: string;
  version?: string;
  main?: string; // TODO Support
  bin?: { [key: string]: string }; // TODO Support
  files?: string[];
  scaffoldly?: ScaffoldlyConfig;
};

export class CiCommand {
  dockerService: DockerService;
  constructor() {
    this.dockerService = new DockerService(this.cwd);
  }

  get cwd(): string {
    // TODO, use __dirname??
    console.log('!!!! __dirname', __dirname);
    console.log('!!! process.cwd()', process.cwd());
    return process.cwd();
  }

  get packageJson(): PackageJson {
    const packageJson = JSON.parse(readFileSync(join(this.cwd, 'package.json'), 'utf8'));

    return packageJson;
  }

  get config(): ScaffoldlyConfig {
    const packageJson = this.packageJson;

    const { name, files = [], scaffoldly: config } = packageJson;

    if (!config) {
      throw new Error('Missing `scaffoldly` in package.json');
    }

    if (!name) {
      throw new Error('Missing `name` in package.json');
    }

    if (!config.name) {
      config.name = name;
    }

    config.files = this.prepareFiles(files, config);

    return config;
  }

  protected prepareFiles(files: string[], config: ScaffoldlyConfig): string[] {
    return [
      ...new Set(
        [...['README.md', 'LICENSE', 'package.json'], ...files, ...(config.files || [])].reduce(
          (acc, file) => {
            if (file.startsWith('!')) {
              return acc;
            }

            acc.push(join(this.cwd, file));

            return acc;
          },
          [] as string[],
        ),
      ),
    ];
  }

  async deploy(): Promise<void> {
    console.log('Deploying...');
  }
}
