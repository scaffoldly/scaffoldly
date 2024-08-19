import {
  AddPermissionCommand,
  CreateFunctionCommand,
  CreateFunctionUrlConfigCommand,
  GetFunctionCommand,
  GetFunctionUrlConfigCommand,
  LambdaClient,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  // eslint-disable-next-line import/named
  FunctionConfiguration,
  // eslint-disable-next-line import/named
  AddPermissionRequest,
  // eslint-disable-next-line import/named
  GetFunctionCommandOutput,
  // eslint-disable-next-line import/named
  GetFunctionUrlConfigCommandOutput,
  UpdateFunctionUrlConfigCommand,
  GetPolicyCommand,
  // eslint-disable-next-line import/named
  GetPolicyCommandOutput,
} from '@aws-sdk/client-lambda';
import { ScaffoldlyConfig } from '../../../../config';
import { IamConsumer, PolicyDocument, TrustRelationship } from './iam';
import { DeployStatus } from '.';
import { CloudResource, ResourceOptions } from '..';
import { EnvService } from '../env';
import { DockerService } from '../docker';
import { Architecture } from '../../ci/docker';

export type LambdaDeployStatus = {
  functionArn?: string;
  architecture?: Architecture;
  imageUri?: string;
  origin?: string;
};

export class LambdaService implements IamConsumer {
  lambdaClient: LambdaClient;

  constructor(
    private config: ScaffoldlyConfig,
    private envService: EnvService,
    private dockerService: DockerService,
  ) {
    this.lambdaClient = new LambdaClient();
  }

  public async predeploy(status: LambdaDeployStatus, options: ResourceOptions): Promise<void> {
    const configuration = await this.configureFunction(status, options);
    status.functionArn = configuration.FunctionArn;
    status.architecture = configuration.Architectures?.[0];

    await this.configureOrigin(status, options);
    await this.configurePermissions(status, options);
  }

  public async deploy(status: LambdaDeployStatus, options: ResourceOptions): Promise<void> {
    const { imageUri, architecture } = await this.publishCode(status, options);
    status.imageUri = imageUri;
    // TODO: Warn if architecture changes
    status.architecture = architecture;

    // const origin = await this.configureOrigin(status, options);
    // lambdaDeployStatus.origin = origin;
  }

  private async configureFunction(
    status: DeployStatus,
    options: ResourceOptions,
  ): Promise<FunctionConfiguration> {
    const { name } = this.config;

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
        describe: (resource) => {
          return { type: 'Lambda Function', label: resource.FunctionName };
        },
        read: () => this.lambdaClient.send(new GetFunctionCommand({ FunctionName: name })),
        create: () =>
          this.dockerService.getPlatform('match-host').then((platform) =>
            this.lambdaClient.send(
              new CreateFunctionCommand({
                Code: {
                  ImageUri: `${repositoryUri}@${imageDigest}`,
                },
                FunctionName: name,
                Publish: false,
                PackageType: 'Image',
                Architectures: platform === 'linux/arm64' ? ['arm64'] : ['x86_64'],
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
    status: LambdaDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    const { name } = this.config;

    const { functionUrl } = await new CloudResource<
      { functionUrl: string },
      GetFunctionUrlConfigCommandOutput
    >(
      {
        describe: (resource) => {
          return { type: 'Function URL', label: resource.functionUrl };
        },
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

    status.origin = functionUrl;
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
        describe: (resource) => {
          return {
            type: 'Function Policies',
            label: `${resource.policy?.Statement?.map((s) => s.Sid)}`,
          };
        },
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
  ): Promise<{ imageUri?: string; architecture?: Architecture }> {
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

    const { imageUri, architecture } = await new CloudResource<
      { imageUri: string; architecture: Architecture },
      GetFunctionCommandOutput
    >(
      {
        describe: (resource) => {
          return { type: 'Function Code', label: resource.imageUri?.split('/').pop() };
        },
        read: () => this.lambdaClient.send(new GetFunctionCommand({ FunctionName: name })),
        update: () =>
          this.dockerService.getPlatform('match-host').then((platform) =>
            this.lambdaClient.send(
              new UpdateFunctionCodeCommand({
                FunctionName: name,
                ImageUri: desired.Code?.ImageUri,
                Architectures: platform === 'linux/arm64' ? ['arm64'] : ['x86_64'],
                Publish: true,
              }),
            ),
          ),
      },
      (output) => {
        return {
          imageUri: output.Code?.ImageUri,
          architecture: output.Configuration?.Architectures?.[0],
        };
      },
    ).manage({ ...options, retries: Infinity }, desired);

    return { imageUri, architecture };
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
