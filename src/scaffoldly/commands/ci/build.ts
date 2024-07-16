import { event } from '../../helpers/events';
import { CiCommand } from '.';
import { ui } from '../../command';

export class BuildCommand extends CiCommand {
  async handle(): Promise<void> {
    event('build');

    ui.updateBottomBar('Building Docker Image');
    await this.dockerService.build(this.config, 'build');

    ui.updateBottomBar('');
    return;
  }
}
