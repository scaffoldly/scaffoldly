import {
  AddPermissionCommand,
  CreateFunctionCommand,
  CreateFunctionUrlConfigCommand,
  GetFunctionCommand,
  GetFunctionUrlConfigCommand,
  LambdaClient,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  FunctionConfiguration,
  AddPermissionRequest,
  Architecture,
  GetFunctionCommandOutput,
  GetFunctionUrlConfigCommandOutput,
  UpdateFunctionUrlConfigCommand,
  GetPolicyCommand,
  GetPolicyCommandOutput,
} from '@aws-sdk/client-lambda';
import { ScaffoldlyConfig } from '../../../../config';
import { IamConsumer, PolicyDocument, TrustRelationship } from './iam';
import { ui } from '../../../command';
import _ from 'lodash';
import { DeployStatus } from '.';
import { CloudResource, ResourceOptions } from '..';
import { EnvService } from '../env';

export type LambdaDeployStatus = {
  functionArn?: string;
  functionArchitecture?: Architecture;
  imageUri?: string;
  origin?: string;
};

export class LambdaService implements IamConsumer {
  lambdaClient: LambdaClient;

  constructor(private config: ScaffoldlyConfig, private envService: EnvService) {
    this.lambdaClient = new LambdaClient();
  }

  public async predeploy(status: DeployStatus, options: ResourceOptions): Promise<DeployStatus> {
    const lambdaDeployStatus: LambdaDeployStatus = {};

    ui.updateBottomBar('Preparing Lambda Function');
    const configuration = await this.configureFunction(status, options);
    status.functionArn = configuration.FunctionArn;
    status.functionArchitecture = configuration.Architectures?.[0];

    ui.updateBottomBar('Preparing Function URL');
    const origin = await this.configureOrigin(status, options);
    lambdaDeployStatus.origin = origin;

    ui.updateBottomBar('Preparing Function Permissions');
    await this.configurePermissions(status, options);

    return { ...status, ...lambdaDeployStatus };
  }

  public async deploy(status: DeployStatus, options: ResourceOptions): Promise<DeployStatus> {
    const lambdaDeployStatus: LambdaDeployStatus = {};

    ui.updateBottomBar('Publishing Code');
    const imageUri = await this.publishCode(status, options);
    lambdaDeployStatus.imageUri = imageUri;

    // ui.updateBottomBar('Updating Function URL');
    // const origin = await this.configureOrigin(status, options);
    // lambdaDeployStatus.origin = origin;

    return { ...status, ...lambdaDeployStatus };
  }

  private async configureFunction(
    status: DeployStatus,
    options: ResourceOptions,
  ): Promise<FunctionConfiguration> {
    const { name } = this.config;

    const { architecture } = status;
    const architectures: Architecture[] = [];
    switch (architecture) {
      case 'arm64':
        architectures.push('arm64');
        break;
      case 'amd64':
        architectures.push('x86_64');
        break;
      default:
        throw new Error(`Unsupported architecture: ${architecture}`);
    }

    const desired: Partial<GetFunctionCommandOutput> = {
      Configuration: {
        Role: status.roleArn,
        Timeout: 900,
        MemorySize: 1024,
        Environment: {
          Variables: this.envService.runtimeEnv,
        },
        LastUpdateStatus: 'Successful',
        State: 'Active',
      },
    };

    let { repositoryUri, imageDigest } = status;
    if (!repositoryUri || !imageDigest) {
      // Use the Hello World Image if either is unknown, it's the initial deploy
      // TODO: multi-platform builds for hello world
      // TODO: Ship a better hello world image
      repositoryUri = '557208059266.dkr.ecr.us-east-1.amazonaws.com/scaffoldly-hello-world';
      imageDigest = 'sha256:3b5a30e673defa489f2bbb0ed36b558dd22ecc866eaa37a1b81713e32d55560c';
    }

    const configuration = await new CloudResource<FunctionConfiguration, GetFunctionCommandOutput>(
      {
        describe: (existing) => `Lambda Function: ${existing.FunctionName}`,
        read: () => this.lambdaClient.send(new GetFunctionCommand({ FunctionName: name })),
        create: () =>
          this.lambdaClient.send(
            new CreateFunctionCommand({
              Code: {
                ImageUri: `${repositoryUri}@${imageDigest}`,
              },
              FunctionName: name,
              Publish: false,
              PackageType: 'Image',
              Architectures: architectures,
              ImageConfig: {
                EntryPoint: ['.entrypoint'],
                Command: [],
              },
              Role: desired.Configuration?.Role,
              Timeout: desired.Configuration?.Timeout,
              MemorySize: desired.Configuration?.MemorySize,
              Environment: desired.Configuration?.Environment,
            }),
          ),
        update: (existing) =>
          this.lambdaClient.send(
            new UpdateFunctionConfigurationCommand({
              FunctionName: existing.FunctionName,
              ImageConfig: {
                EntryPoint: ['.entrypoint'],
                Command: [],
              },
              Role: desired.Configuration?.Role,
              Timeout: desired.Configuration?.Timeout,
              MemorySize: desired.Configuration?.MemorySize,
              Environment: desired.Configuration?.Environment,
            }),
          ),
      },
      (output) => output?.Configuration,
    ).manage(
      {
        ...options,
        retries: Infinity,
      },
      desired,
    );

    return configuration;
  }

  private async configureOrigin(
    _status: DeployStatus,
    options: ResourceOptions,
  ): Promise<string | undefined> {
    const { name } = this.config;

    const { functionUrl } = await new CloudResource<
      { functionUrl: string },
      GetFunctionUrlConfigCommandOutput
    >(
      {
        describe: (existing) => `Function URL: ${existing.functionUrl}`,
        read: () => this.lambdaClient.send(new GetFunctionUrlConfigCommand({ FunctionName: name })),
        create: () =>
          this.lambdaClient.send(
            new CreateFunctionUrlConfigCommand({
              FunctionName: name,
              AuthType: 'NONE',
              InvokeMode: 'BUFFERED',
              // TODO: Qualifier
            }),
          ),
        update: () =>
          this.lambdaClient.send(
            new UpdateFunctionUrlConfigCommand({
              FunctionName: name,
              AuthType: 'NONE',
              InvokeMode: 'BUFFERED',
              // TODO: Qualifier
            }),
          ),
      },
      (output) => {
        return { functionUrl: output.FunctionUrl };
      },
    ).manage(options);

    return functionUrl;
  }

  private async configurePermissions(
    _status: DeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    const { name } = this.config;

    const requests: AddPermissionRequest[] = [
      {
        FunctionName: name,
        StatementId: 'InvokeFunctionUrl',
        Action: 'lambda:InvokeFunctionUrl',
        Principal: '*',
        FunctionUrlAuthType: 'NONE',
      },
    ];

    await new CloudResource<{ policy: PolicyDocument }, GetPolicyCommandOutput>(
      {
        describe: (existing) =>
          `Function Policies: ${existing.policy?.Statement.map((s) => s.Sid)}`,
        read: () => this.lambdaClient.send(new GetPolicyCommand({ FunctionName: name })),
        create: () =>
          Promise.all(
            requests.map((request) => this.lambdaClient.send(new AddPermissionCommand(request))),
          ),
        update: (existing) => {
          return Promise.all(
            // TODO: Diff check
            requests
              .filter(
                (request) =>
                  !existing.policy?.Statement?.find(
                    (statement) => statement.Sid === request.StatementId,
                  ),
              )
              .map((request) => this.lambdaClient.send(new AddPermissionCommand(request))),
          );
        },
      },
      (output) => {
        return { policy: JSON.parse(output.Policy || '{}') };
      },
    ).manage(options);
  }

  private async publishCode(
    status: DeployStatus,
    options: ResourceOptions,
  ): Promise<string | undefined> {
    const { name } = this.config;

    const desired: Partial<GetFunctionCommandOutput> = {
      Code: {
        ImageUri: `${status.repositoryUri}@${status.imageDigest}`,
      },
      Configuration: {
        LastUpdateStatus: 'Successful',
        State: 'Active',
      },
    };

    const { imageUri } = await new CloudResource<{ imageUri: string }, GetFunctionCommandOutput>(
      {
        describe: (existing) => `Function Image: ${existing.imageUri}`,
        read: () => this.lambdaClient.send(new GetFunctionCommand({ FunctionName: name })),
        update: () =>
          this.lambdaClient.send(
            new UpdateFunctionCodeCommand({
              FunctionName: name,
              Architectures: status.functionArchitecture
                ? [status.functionArchitecture]
                : undefined,
              ImageUri: desired.Code?.ImageUri,
              Publish: true,
            }),
          ),
      },
      (output) => {
        return { imageUri: output.Code?.ImageUri };
      },
    ).manage({ ...options, retries: Infinity }, desired);

    return imageUri;
  }

  get trustRelationship(): TrustRelationship {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'lambda.amazonaws.com',
          },
          Action: 'sts:AssumeRole',
        },
      ],
    };
  }

  get policyDocument(): PolicyDocument {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Action: [
            'logs:CreateLogStream',
            'logs:CreateLogGroup',
            'logs:TagResource',
            'logs:PutLogEvents',
            'xray:PutTraceSegments',
            'xray:PutTelemetryRecords',
          ],
          Resource: ['*'],
          Effect: 'Allow',
        },
      ],
    };
  }
}
