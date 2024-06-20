import { readFileSync } from 'fs';
import { event } from '../helpers/events';
import { ScaffoldlyConfig } from './config';
import { DockerService } from './docker';
import path from 'path';

export type PackageJson = {
  name?: string;
  version?: string;
  scaffoldly?: ScaffoldlyConfig;
};

export class DevCommand {
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
    const packageJson = JSON.parse(readFileSync(path.join(this.cwd, 'package.json'), 'utf8'));

    return packageJson;
  }

  async handle(): Promise<void> {
    event('dev');

    const packageJson = this.packageJson;

    const { name, scaffoldly: config } = packageJson;

    if (!config) {
      throw new Error('Missing `scaffoldly` in package.json');
    }

    if (!name) {
      throw new Error('Missing `name` in package.json');
    }

    if (!config.name) {
      config.name = name;
    }

    await this.dockerService.build(config, 'develop');

    return;
  }
}
