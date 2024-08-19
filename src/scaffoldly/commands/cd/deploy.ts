import { CdCommand, ResourceOptions } from '.';
import { event } from '../../helpers/events';
import { DockerService as DockerCiService } from '../ci/docker';
import { GitService } from './git';
import { AwsService, DeployStatus } from './aws';
import { ui } from '../../command';
import { isDebug } from '../../ui';
import { EnvService } from './env';
import { DockerService } from './docker';

export class DeployCommand extends CdCommand {
  envService: EnvService;

  awsService: AwsService;

  dockerService: DockerService;

  constructor(private gitService: GitService) {
    super(gitService.cwd);
    this.envService = new EnvService(this.cwd, this.config, this.gitService);
    this.dockerService = new DockerService(this.config, new DockerCiService(this.cwd));
    this.awsService = new AwsService(this.config, this.envService, this.dockerService);
  }

  async handle(status: DeployStatus, options?: ResourceOptions): Promise<void> {
    event('deploy');

    options = options || {};

    await this.gitService.predeploy(status, options);
    await this.awsService.predeploy(status, options);
    await this.awsService.deploy(status, options);

    ui.updateBottomBar('');
    if (isDebug()) {
      console.table(status);
    }
    console.log('');
    console.log('🚀 Deployment Complete!');
    console.log(`   🌎 URL: ${status.url}`);
  }
}
