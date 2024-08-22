import { CdCommand, ResourceOptions } from '.';
import { event } from '../../helpers/events';
import { DockerService as DockerCiService } from '../ci/docker';
import { GitService } from './git';
import { AwsService, DeployStatus } from './aws';
import { ui } from '../../command';
import { isDebug } from '../../ui';
import { EnvService } from './env';
import { DockerService } from './docker';
import { filesize } from 'filesize';

export type Preset = 'nextjs';

export class DeployCommand extends CdCommand<DeployCommand> {
  envService: EnvService;

  awsService: AwsService;

  dockerService: DockerService;

  constructor(private gitService: GitService) {
    super(gitService.cwd);
    this.envService = new EnvService(this.gitService);
    this.dockerService = new DockerService(this.gitService, new DockerCiService(this.cwd));
    this.awsService = new AwsService(this.gitService, this.envService, this.dockerService);
  }

  async handle(): Promise<void> {
    await this._handle({}, {});
  }

  async _handle(status: DeployStatus, options?: ResourceOptions): Promise<void> {
    event('deploy');

    options = options || {};

    this.gitService.setConfig(this.config);

    await this.gitService.predeploy(status, options);
    await this.awsService.predeploy(status, options);
    await this.awsService.deploy(status, options);

    ui.updateBottomBar('');
    if (isDebug()) {
      console.table(status);
    }
    console.log('');
    console.log('🚀 Deployment Complete!');
    console.log(`   📄 Env Files: ${status.envFiles?.join(', ')}`);
    console.log(`   📦 Image Size: ${filesize(status.imageSize || 0)}`);
    console.log(`   🌎 Function URL: ${status.url}`);
  }
}
