import { CdCommand, ResourceOptions } from './cd';
import { DockerService as DockerCiService } from './ci/docker';
import { GitService } from './cd/git';
import { AwsService, DeployStatus } from './cd/aws';
import { ui } from '../command';
import { isDebug } from '../ui';
import { EnvService } from './ci/env';
import { DockerService } from './cd/docker';
import { filesize } from 'filesize';
import { Mode } from '../../config';

export type Preset = 'nextjs';
export const PRESETS: Preset[] = ['nextjs'];

export class DeployCommand extends CdCommand<DeployCommand> {
  envService: EnvService;

  awsService: AwsService;

  dockerService: DockerService;

  status: DeployStatus = {};

  options: ResourceOptions = {};

  constructor(private gitService: GitService, mode: Mode = 'production') {
    super(gitService.cwd, mode);
    this.envService = new EnvService(this.gitService);
    this.dockerService = new DockerService(this.gitService, new DockerCiService(this.cwd));
    this.awsService = new AwsService(this.gitService, this.envService, this.dockerService);
  }

  withMode(mode?: Mode): DeployCommand {
    super.withMode(mode);
    return this;
  }

  withStatus(status: DeployStatus): DeployCommand {
    this.status = status;
    return this;
  }

  withOptions(options: ResourceOptions): DeployCommand {
    this.options = options;
    return this;
  }

  async handle(subcommand?: 'dockerfile' | 'config'): Promise<void> {
    this.options = this.options || {};
    this.options.permissionsAware = this;
    this.gitService.setConfig(this.config);

    if (this.options.dev) {
      this.dockerService.dockerCiService.withIgnoredFiles(this.config.ignoredFiles);
    }

    if (subcommand === 'dockerfile') {
      ui.updateBottomBar('Generating Dockerfile...');
      const dockerfile = await this.dockerService.dockerCiService.generateDockerfile(
        this.gitService.config,
      );
      ui.updateBottomBar('');
      return console.log(dockerfile.dockerfile);
    }

    if (subcommand === 'config') {
      return console.log(JSON.stringify(this.gitService.config.scaffoldly, null, 2));
    }

    if (!subcommand) {
      return this._handle(this.status);
    }
  }

  private async _handle(status: DeployStatus): Promise<void> {
    if (this.options.checkPermissions) {
      ui.updateBottomBar('Checking Permissions');
    }

    await this.gitService.predeploy(status, this.options);
    await this.awsService.predeploy(status, this.options);
    await this.awsService.deploy(status, this.options);

    ui.updateBottomBar('');
    if (isDebug()) {
      console.table(status);
    }

    if (this.options.checkPermissions) {
      console.log('');
      console.log('🔐 The following policy is needed for deployment:');
      console.log('');
      console.log(JSON.stringify(this.awsPolicyDocument, null, 2));
      console.log('');
      return console.log('📖 See: https://scaffoldly.dev/docs/cloud/aws');
    }

    console.log('');
    console.log('🚀 Deployment Complete!');
    console.log(`   📄 Env Files: ${status.envFiles?.join(', ')}`);
    console.log(`   📦 Image Size: ${filesize(status.imageSize || 0)}`);
    console.log(`   🌎 Function URL: ${status.url}`);
  }
}
