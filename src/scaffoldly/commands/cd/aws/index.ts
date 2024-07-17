import { DockerService as DockerCiService } from '../../ci/docker';
import { ScaffoldlyConfig } from '../../../../config';
import { LambdaDeployStatus, LambdaService } from './lambda';
import { ResourceOptions } from '..';
import { IamDeployStatus, IamService } from './iam';
import { EcrDeployStatus, EcrService } from './ecr';
import { ui } from '../../../command';
import { DockerDeployStatus, DockerService } from '../docker';
import { Cwd } from '../..';
import { SecretDeployStatus, SecretService } from './secret';

export type DeployStatus = DockerDeployStatus &
  EcrDeployStatus &
  IamDeployStatus &
  SecretDeployStatus &
  LambdaDeployStatus;

export class AwsService {
  dockerService: DockerService;

  secretService: SecretService;

  iamService: IamService;

  ecrService: EcrService;

  lambdaService: LambdaService;

  constructor(private cwd: Cwd, private config: ScaffoldlyConfig, dockerService: DockerCiService) {
    this.dockerService = new DockerService(this.config, dockerService);
    this.secretService = new SecretService(this.config);
    this.iamService = new IamService(this.config);
    this.ecrService = new EcrService(this.config);
    this.lambdaService = new LambdaService(this.cwd, this.config);
  }

  async deploy(): Promise<void> {
    const options: ResourceOptions = {};
    let status: DeployStatus = {};

    // Deploy Secret
    status = {
      ...status,
      ...(await this.secretService.deploy(status, this.config, options)),
    };

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
