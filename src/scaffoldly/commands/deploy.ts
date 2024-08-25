import { CdCommand, ResourceOptions } from './cd';
import { DockerService as DockerCiService } from './ci/docker';
import { GitService } from './cd/git';
import { AwsService, DeployStatus } from './cd/aws';
import { ui } from '../command';
import { isDebug } from '../ui';
import { EnvService } from './cd/env';
import { DockerService } from './cd/docker';
import { filesize } from 'filesize';

export type Preset = 'nextjs';

export class DeployCommand extends CdCommand<DeployCommand> {
  envService: EnvService;

  awsService: AwsService;

  dockerService: DockerService;

  status: DeployStatus = {};

  options: ResourceOptions = {};

  constructor(private gitService: GitService) {
    super(gitService.cwd);
    this.envService = new EnvService(this.gitService);
    this.dockerService = new DockerService(this.gitService, new DockerCiService(this.cwd));
    this.awsService = new AwsService(this.gitService, this.envService, this.dockerService);
  }

  withStatus(status: DeployStatus): DeployCommand {
    this.status = status;
    return this;
  }

  withOptions(options: ResourceOptions): DeployCommand {
    this.options = options;
    return this;
  }

  async handle(): Promise<void> {
    await this._handle(this.status, this.options);
  }

  private async _handle(status: DeployStatus, options?: ResourceOptions): Promise<void> {
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
    console.log(`   🧠 Architecture: ${status.architecture}`);
    console.log(`   📄 Env Files: ${status.envFiles?.join(', ')}`);
    console.log(`   📦 Image Size: ${filesize(status.imageSize || 0)}`);
    console.log(`   🌎 Function URL: ${status.url}`);
  }
}
