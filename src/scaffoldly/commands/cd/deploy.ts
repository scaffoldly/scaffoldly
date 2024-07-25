import { CdCommand } from '.';
import { event } from '../../helpers/events';
import { DockerService } from '../ci/docker';
import { GitService } from '../ci/git';
import { AwsService } from './aws';

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

    // TODO Check if auth'd to AWS
    await this.awsService.deploy();

    return;
  }
}
