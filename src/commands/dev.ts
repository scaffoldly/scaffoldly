import { event } from '../helpers/events';
import { DockerCompose } from './docker';
import path from 'path';

export class DevCommand {
  constructor() {}

  get cwd(): string {
    return process.cwd();
  }

  get dockerCompose(): DockerCompose {
    return new DockerCompose(path.join(this.cwd, 'docker-compose.yml'));
  }

  async handle(): Promise<void> {
    event('dev');

    const services = this.dockerCompose.serviceNames;

    await Promise.all(services.map((name) => this.dockerCompose.build(name)));

    return;
  }
}
