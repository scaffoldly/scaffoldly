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
import { GitService } from '../../ci/git';
import { isDebug } from '../../../ui';

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

  constructor(
    private cwd: Cwd,
    private config: ScaffoldlyConfig,
    private gitService: GitService,
    dockerService: DockerCiService,
  ) {
    this.dockerService = new DockerService(this.config, dockerService);
    this.secretService = new SecretService(this.config);
    this.iamService = new IamService(this.config);
    this.ecrService = new EcrService(this.config, this.dockerService);
    this.lambdaService = new LambdaService(this.cwd, this.config);
  }

  async deploy(): Promise<void> {
    const options: ResourceOptions = {};
    let status: DeployStatus = {};

    // Deploy ECR with a unqualified name
    this.config.id = '';
    status = {
      ...status,
      ...(await this.ecrService.deploy(status, options)),
    };

    const branch = await this.gitService.branch;
    if (!branch) {
      throw new Error('Missing branch. Make sure this repo is initialized with git.');
    }

    // Deploy Secret using branch name for uniqueness
    this.config.id = branch;
    status = {
      ...status,
      ...(await this.secretService.deploy(status, this.config, options)),
    };

    // Set Unique ID for the rest of the steps...
    this.config.id = status.uniqueId || '';
    // Deploy IAM
    status = {
      ...status,
      ...(await this.iamService.deploy(status, this.lambdaService, options)),
    };

    // Pre-Deploy Lambda (Creates the Function URL and other pre-deploy steps)
    status = {
      ...status,
      ...(await this.lambdaService.predeploy(status, options)),
    };

    // Deploy Docker Container using uniqueId in status for uniqueness
    status = {
      ...status,
      ...(await this.dockerService.deploy(status, this.ecrService, options)),
    };

    // Deploy Lambda
    status = {
      ...status,
      ...(await this.lambdaService.deploy(status, options)),
    };

    ui.updateBottomBar('');
    if (isDebug()) {
      console.table(status);
    }
    console.log('');
    console.log('🚀 Deployment Complete!');
    console.log(`   🌎 URL: ${status.url}`);
  }
}
