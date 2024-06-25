import { event } from '../../helpers/events';
import { CiCommand } from '.';

export class DevCommand extends CiCommand {
  constructor() {
    super();
  }

  async handle(): Promise<void> {
    event('dev');

    await this.dockerService.build(this.config, 'develop');

    return;
  }
}
