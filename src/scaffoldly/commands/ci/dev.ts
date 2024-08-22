import { event } from '../../helpers/events';
import { CiCommand } from '.';

export class DevCommand extends CiCommand<DevCommand> {
  async handle(): Promise<void> {
    event('dev');

    await this.dockerService.build(this.config, 'dev', 'match-host');

    return;
  }
}
