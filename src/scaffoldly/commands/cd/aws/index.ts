import { LambdaDeployStatus, LambdaService } from './lambda';
import { ResourceOptions } from '..';
import { IamDeployStatus, IamService, IdentityStatus } from './iam';
import { EcrDeployStatus, EcrService } from './ecr';
import { DockerDeployStatus, DockerService } from '../docker';
import { SecretDeployStatus, SecretService } from './secret';
import { GitDeployStatus, GitService } from '../git';
import { EnvDeployStatus, EnvService } from '../../ci/env';
import { ScheduleService, ScheduleDeployStatus } from './schedule';
import { ResourcesService } from './resources';
import { ResourcesDeployStatus } from './resources/resource';

export type DeployStatus = GitDeployStatus &
  EnvDeployStatus &
  DockerDeployStatus &
  IdentityStatus &
  EcrDeployStatus &
  IamDeployStatus &
  SecretDeployStatus &
  LambdaDeployStatus &
  ScheduleDeployStatus &
  ResourcesDeployStatus;

export class AwsService {
  secretService: SecretService;

  iamService: IamService;

  ecrService: EcrService;

  lambdaService: LambdaService;

  resourcesService: ResourcesService;

  scheduleService: ScheduleService;

  constructor(
    private gitService: GitService,
    private envService: EnvService,
    private dockerService: DockerService,
  ) {
    this.resourcesService = new ResourcesService(gitService);
    this.secretService = new SecretService(gitService, envService);
    this.iamService = new IamService(gitService);
    this.ecrService = new EcrService(gitService);
    this.lambdaService = new LambdaService(gitService, this.dockerService, envService);
    this.scheduleService = new ScheduleService(gitService);

    this.envService.addProducer(this.resourcesService);
    this.envService.addProducer(this.secretService);
    this.envService.addProducer(this.lambdaService);
  }

  async predeploy(status: DeployStatus, options: ResourceOptions): Promise<void> {
    // Check Identity and Permissions
    await this.iamService.identity(status, options);

    // Deploy ECR
    await this.ecrService.predeploy(status, options);

    // Deploy Docker
    await this.dockerService.predeploy(status, this.ecrService, options);

    // Deploy Secret
    await this.secretService.predeploy(status, options);

    // Deploy Resources
    await this.resourcesService.predeploy(status, options);

    // Deploy IAM
    await this.iamService.predeploy(
      status,
      [this.secretService, this.lambdaService, this.resourcesService, this.scheduleService],
      options,
    );

    // Pre-Deploy Lambda (Creates the Function URL and other pre-deploy steps)
    await this.lambdaService.predeploy(status, options);

    // Set a Unique ID for the rest of the steps...
    this.gitService.config.id = status.uniqueId || '';

    // Pre-Deploy Schedules
    await this.scheduleService.predeploy(status, options);

    // Pre-Deploy Environment Variables
    await this.envService.predeploy(status);
  }

  async deploy(status: DeployStatus, options: ResourceOptions): Promise<void> {
    // Deploy Environment Variables
    await this.envService.deploy(status, options);

    // Deploy Docker Container
    await this.dockerService.deploy(status, this.ecrService, options);

    // Deploy Secrets
    await this.secretService.deploy(status, options);

    // Deploy Lambda
    await this.lambdaService.deploy(status, [this.resourcesService], options);

    // Deploy Schedules
    await this.scheduleService.deploy(status, options);
  }
}
