import { event } from '../../helpers/events';
import { CiCommand } from '.';

export class BuildCommand extends CiCommand {
  async handle(): Promise<void> {
    event('build');

    await this.dockerService.build(this.config, 'build');

    return;
  }
}
