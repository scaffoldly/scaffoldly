import { CdCommand, ResourceOptions } from '.';
import { event } from '../../helpers/events';
import { DockerService as DockerCiService } from '../ci/docker';
import { GitService } from './git';
import { AwsService } from './aws';
import { ui } from '../../command';
import { isDebug } from '../../ui';
import { EnvService } from './env';
import { DockerService } from './docker';

export class DeployCommand extends CdCommand {
  gitService: GitService;

  envService: EnvService;

  awsService: AwsService;

  dockerService: DockerService;

  constructor() {
    super();
    this.gitService = new GitService(this.cwd);
    this.envService = new EnvService(this.cwd, this.config);
    this.dockerService = new DockerService(this.config, new DockerCiService(this.cwd));
    this.awsService = new AwsService(
      this.config,
      this.gitService,
      this.envService,
      this.dockerService,
    );
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
