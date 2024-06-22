import { event } from '../../helpers/events';
import { DockerService } from './docker';
import { CiCommand } from '.';

export class DevCommand extends CiCommand {
  constructor() {
    super();
    this.dockerService = new DockerService(this.cwd);
  }

  async handle(): Promise<void> {
    event('dev');

    await this.dockerService.build(this.config, 'develop');

    return;
  }
}
