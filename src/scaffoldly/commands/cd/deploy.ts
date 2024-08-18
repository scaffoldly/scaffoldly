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
    this.envService = new EnvService(this.cwd, this.config);
    this.dockerService = new DockerService(this.config, new DockerCiService(this.cwd));
    this.awsService = new AwsService(
      this.config,
      this.gitService,
      this.envService,
      this.dockerService,
    );
  }

  async handle(): Promise<DeployStatus> {
    event('deploy');

    const options: ResourceOptions = {}; // TODO: Add options
    let status: DeployStatus = {};

    try {
      status = await this.gitService.predeploy(status, options);
    } catch (e) {
      throw new Error(`Error predeploying git: ${e.message}`, { cause: e });
    }

    try {
      status = await this.awsService.predeploy(status, options);
    } catch (e) {
      throw new Error(`Error predeploying AWS: ${e.message}`, { cause: e });
    }

    try {
      status = await this.awsService.deploy(status, options);
    } catch (e) {
      throw new Error(`Error deploying AWS: ${e.message}`, { cause: e });
    }

    ui.updateBottomBar('');
    if (isDebug()) {
      console.table(status);
    }
    console.log('');
    console.log('🚀 Deployment Complete!');
    console.log(`   🌎 Origin: ${status.origin}`);

    return status;
  }
}
