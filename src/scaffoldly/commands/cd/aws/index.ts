import { ScaffoldlyConfig } from '../../../../config';
import { LambdaDeployStatus, LambdaService } from './lambda';
import { ResourceOptions } from '..';
import { IamDeployStatus, IamService } from './iam';
import { EcrDeployStatus, EcrService } from './ecr';
import { DockerDeployStatus, DockerService } from '../docker';
import { SecretDeployStatus, SecretService } from './secret';
import { GitDeployStatus, GitService } from '../git';
import { EnvDeployStatus, EnvService } from '../env';
import { ScheduleService, ScheduleStatus } from './schedule';
import { DynamoDbService } from './dynamodb';

export type DeployStatus = GitDeployStatus &
  EnvDeployStatus &
  DockerDeployStatus &
  EcrDeployStatus &
  IamDeployStatus &
  SecretDeployStatus &
  LambdaDeployStatus &
  ScheduleStatus;

export class AwsService {
  secretService: SecretService;

  iamService: IamService;

  ecrService: EcrService;

  lambdaService: LambdaService;

  dynamoDbService: DynamoDbService;

  scheduleService: ScheduleService;

  constructor(
    private config: ScaffoldlyConfig,
    private gitService: GitService,
    private envService: EnvService,
    private dockerService: DockerService,
  ) {
    this.secretService = new SecretService(this.config);
    this.iamService = new IamService(this.config);
    this.ecrService = new EcrService(this.config, this.dockerService);
    this.lambdaService = new LambdaService(this.config, this.envService);
    this.dynamoDbService = new DynamoDbService(this.config);
    this.scheduleService = new ScheduleService(this.config);
  }

  async predeploy(status: DeployStatus, options: ResourceOptions): Promise<DeployStatus> {
    // TODO Check if auth'd to AWS

    // Deploy ECR with a unqualified name
    this.config.id = '';
    status = await this.ecrService.predeploy(status, options);

    const branch = await this.gitService.branch;
    if (!branch) {
      throw new Error('Missing branch. Make sure this repo is initialized with git.');
    }

    // Deploy Secret using branch name for uniqueness
    this.config.id = branch;
    status = await this.secretService.predeploy(status, this.config, options);

    // Set Unique ID for the rest of the steps...
    this.config.id = status.uniqueId || '';
    // Deploy IAM
    status = await this.iamService.predeploy(
      status,
      [this.secretService, this.lambdaService, this.dynamoDbService, this.scheduleService],
      options,
    );

    // Pre-Deploy Lambda (Creates the Function URL and other pre-deploy steps)
    status = await this.lambdaService.predeploy(status, options);

    // Pre-Deploy Schedules
    status = await this.scheduleService.predeploy(status, options);

    // Pre-Deploy Environment Variables
    status = await this.envService.predeploy(status, options);

    return status;
  }

  async deploy(status: DeployStatus, options: ResourceOptions): Promise<DeployStatus> {
    // Deploy Environment Variables
    status = await this.envService.deploy(status, options);

    // Deploy Docker Container
    status = await this.dockerService.deploy(status, this.ecrService, options);

    // Deploy Lambda
    status = await this.lambdaService.deploy(status, options);

    // Deploy Events
    status = await this.scheduleService.deploy(status, options);

    return status;
  }
}
