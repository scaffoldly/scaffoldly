import { LambdaDeployStatus, LambdaService } from './lambda';
import { ResourceOptions } from '..';
import { IamDeployStatus, IamService } from './iam';
import { EcrDeployStatus, EcrService } from './ecr';
import { DockerDeployStatus, DockerService } from '../docker';
import { SecretDeployStatus, SecretService } from './secret';
import { GitDeployStatus, GitService } from '../git';
import { EnvDeployStatus, EnvService } from '../env';
import { ScheduleService, ScheduleDeployStatus } from './schedule';
import { DynamoDbService } from './dynamodb';

export type DeployStatus = GitDeployStatus &
  EnvDeployStatus &
  DockerDeployStatus &
  EcrDeployStatus &
  IamDeployStatus &
  SecretDeployStatus &
  LambdaDeployStatus &
  ScheduleDeployStatus;

export class AwsService {
  secretService: SecretService;

  iamService: IamService;

  ecrService: EcrService;

  lambdaService: LambdaService;

  dynamoDbService: DynamoDbService;

  scheduleService: ScheduleService;

  constructor(
    private gitService: GitService,
    private envService: EnvService,
    private dockerService: DockerService,
  ) {
    this.secretService = new SecretService(gitService);
    this.iamService = new IamService(gitService);
    this.ecrService = new EcrService(gitService);
    this.lambdaService = new LambdaService(gitService, this.envService, this.dockerService);
    this.dynamoDbService = new DynamoDbService(gitService);
    this.scheduleService = new ScheduleService(gitService);
  }

  async predeploy(status: DeployStatus, options: ResourceOptions): Promise<void> {
    // TODO Check if auth'd to AWS

    // Deploy ECR
    await this.ecrService.predeploy(status, options);

    // Deploy Secret
    await this.secretService.predeploy(status, this.gitService.config, options);

    // Deploy IAM
    await this.iamService.predeploy(
      status,
      [this.secretService, this.lambdaService, this.dynamoDbService, this.scheduleService],
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

    // Deploy Lambda
    await this.lambdaService.deploy(status, options);

    // Deploy Schedules
    await this.scheduleService.deploy(status, options);
  }
}
