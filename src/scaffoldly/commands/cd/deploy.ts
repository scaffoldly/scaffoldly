import { CdCommand, ResourceOptions } from '.';
import { event } from '../../helpers/events';
import { DockerService } from '../ci/docker';
import { GitService } from './git';
import { AwsService } from './aws';
import { ui } from '../../command';
import { isDebug } from '../../ui';

export class DeployCommand extends CdCommand {
  gitService: GitService;

  awsService: AwsService;

  dockerService: DockerService;

  constructor() {
    super();
    this.gitService = new GitService(this.cwd);
    this.dockerService = new DockerService(this.cwd);
    this.awsService = new AwsService(this.cwd, this.config, this.gitService, this.dockerService);
  }

  async handle(): Promise<void> {
    event('deploy');

    const options: ResourceOptions = {}; // TODO: Add options

    const status = await this.gitService
      .predeploy({}, options)

      .then((s) => this.awsService.predeploy(s, options))
      .then((s) => this.awsService.deploy(s, options));

    ui.updateBottomBar('');
    if (isDebug()) {
      console.table(status);
    }
    console.log('');
    console.log('🚀 Deployment Complete!');
    console.log(`   🌎 Origin: ${status.origin}`);

    return;
  }
}
