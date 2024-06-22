import { event } from '../../helpers/events';
import { DockerService } from './docker';
import { CiCommand } from '.';

export class BuildCommand extends CiCommand {
  constructor() {
    super();
    this.dockerService = new DockerService(this.cwd);
  }

  async handle(): Promise<void> {
    event('build');

    await this.dockerService.build(this.config, 'build');

    return;
  }
}
