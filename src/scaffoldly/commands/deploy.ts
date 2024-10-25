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

export type PresetType = 'nextjs';
export const PRESETS: PresetType[] = ['nextjs'];

export class DeployCommand extends CdCommand<DeployCommand> {
  envService: EnvService;

  awsService: AwsService;

  dockerService: DockerService;

  status: DeployStatus = {};

  options: ResourceOptions = {};

  constructor(
    protected gitService: GitService,
    secrets: Record<string, string | undefined>,
    mode: Mode = 'production',
  ) {
    super(gitService, mode);
    this.envService = new EnvService(gitService, secrets);
    this.dockerService = new DockerService(gitService, new DockerCiService(gitService));
    this.awsService = new AwsService(gitService, this.envService, this.dockerService);
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

  async handle(subcommand?: 'dockerfile' | 'show-config' | 'save-config'): Promise<void> {
    this.options = this.options || {};
    this.options.permissionsAware = this;

    const config = await this.config;
    this.gitService.setConfig(config);

    if (this.options.dev) {
      this.dockerService.dockerCiService.withIgnoredFiles(config.ignoredFiles);
    }

    if (subcommand === 'dockerfile') {
      ui.updateBottomBar('Generating Dockerfile');
      const workDir = await this.gitService.workDir;
      const dockerfile = await this.dockerService.dockerCiService.generateDockerfile(
        workDir,
        this.gitService.config,
      );
      ui.updateBottomBar('');
      return console.log(dockerfile.dockerfile);
    }

    if (subcommand === 'show-config') {
      return console.log(JSON.stringify(this.gitService.config.scaffoldly, null, 2));
    }

    if (subcommand === 'save-config') {
      const { preset } = this;
      if (!preset) {
        throw new Error('No preset found');
      }
      await preset.save();
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
    console.log(`   🆔 App Identity: ${status.roleArn || 'unknown'}`);
    console.log(`   📄 Env Files: ${status.envFiles?.join(', ')}`);
    console.log(`   📦 Image Size: ${filesize(status.imageSize || 0)}`);
    console.log(`   🌎 URL: ${status.url || 'unknown'}`);
  }
}
