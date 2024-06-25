import { DockerService } from '../../ci/docker';
import { ScaffoldlyConfig } from '../../../../config';
import { LambdaService } from './lambda';

export class AwsService {
  private lambdaService: LambdaService;
  constructor(private dockerService: DockerService, private config: ScaffoldlyConfig) {
    this.lambdaService = new LambdaService(this.dockerService, this.config);
  }

  async deploy() {
    await this.lambdaService.deploy();
  }
}
