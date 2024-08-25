import { CiCommand } from './ci';

export class DevCommand extends CiCommand<DevCommand> {
  async handle(): Promise<void> {
    await this.dockerService.build(this.config, 'dev', 'match-host');

    return;
  }
}
