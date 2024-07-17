import { CdCommand } from '.';
import { event } from '../../helpers/events';
import { DockerService } from '../ci/docker';
import { AwsService } from './aws';

export class DeployCommand extends CdCommand {
  awsService: AwsService;

  dockerService: DockerService;

  constructor() {
    super();
    this.dockerService = new DockerService(this.cwd);
    this.awsService = new AwsService(this.cwd, this.config, this.dockerService);
  }

  async handle(): Promise<void> {
    event('deploy');

    // TODO Check if auth'd to AWS
    await this.awsService.deploy();

    return;
  }
}
