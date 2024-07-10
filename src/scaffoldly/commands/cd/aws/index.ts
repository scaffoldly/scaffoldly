import { DockerService as DockerCiService } from '../../ci/docker';
import { ScaffoldlyConfig } from '../../../../config';
import { LambdaDeployStatus, LambdaService } from './lambda';
import { ResourceOptions } from '..';
import { IamDeployStatus, IamService } from './iam';
import { EcrDeployStatus, EcrService } from './ecr';
import { ui } from '../../../command';
import { DockerDeployStatus, DockerService } from '../docker';

export type DeployStatus = DockerDeployStatus &
  EcrDeployStatus &
  IamDeployStatus &
  LambdaDeployStatus;

export class AwsService {
  dockerService: DockerService;

  iamService: IamService;

  ecrService: EcrService;

  lambdaService: LambdaService;

  constructor(private config: ScaffoldlyConfig, dockerService: DockerCiService) {
    this.dockerService = new DockerService(this.config, dockerService);
    this.iamService = new IamService(this.config);
    this.ecrService = new EcrService(this.config);
    this.lambdaService = new LambdaService(this.config);
  }

  async deploy(): Promise<void> {
    const options: ResourceOptions = {};
    let status: DeployStatus = {};

    // Deploy ECR
    status = {
      ...status,
      ...(await this.ecrService.deploy(status, options)),
    };

    // Deploy Docker Container
    status = {
      ...status,
      ...(await this.dockerService.deploy(status, this.ecrService, options)),
    };

    // Deploy IAM
    status = {
      ...status,
      ...(await this.iamService.deploy(status, this.lambdaService, options)),
    };

    // Deploy Lambda
    status = {
      ...status,
      ...(await this.lambdaService.deploy(status, options)),
    };

    ui.updateBottomBar('');
    console.table(status);
    console.log('🚀 Deployment Complete!');
  }
}
