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
import { IamConsumer, IamDeployStatus, PolicyDocument, TrustRelationship } from './iam';
import { DeployStatus } from '.';
import { CloudResource, ResourceOptions } from '..';
import { EnvService } from '../env';
import { DockerDeployStatus, DockerService } from '../docker';
import { Architecture } from '../../ci/docker';
import { EcrDeployStatus } from './ecr';
import { GitDeployStatus } from '../git';

export type LambdaDeployStatus = {
  functionArn?: string;
  architecture?: Architecture;
  imageUri?: string;
  url?: string;
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
    await this.configureFunction(status, options);
    await this.configureUrl(status, options);
    await this.configurePermissions(status, options);
  }

  public async deploy(status: LambdaDeployStatus, options: ResourceOptions): Promise<void> {
    // TODO: Create Alias for PR branches?
    await this.configureFunction(status, options);
    await this.publishCode(status, options);
    await this.configureUrl(status, options);
  }

  private async configureFunction(
    status: LambdaDeployStatus &
      GitDeployStatus &
      IamDeployStatus &
      EcrDeployStatus &
      DockerDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    const { name } = this.config;
    const { branch } = status;

    const functionName = `${name}-${branch}`;

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
        read: () =>
          this.lambdaClient.send(
            new GetFunctionCommand({ FunctionName: status.functionArn || functionName }),
          ),
        create: () =>
          this.dockerService.getPlatform('match-host').then((platform) =>
            this.lambdaClient.send(
              new CreateFunctionCommand({
                Code: {
                  ImageUri: `${repositoryUri}@${imageDigest}`,
                },
                FunctionName: status.functionArn || functionName,
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
        update: async (existing) => {
          this.lambdaClient.send(
            new UpdateFunctionConfigurationCommand({
              FunctionName: existing.FunctionArn,
              ImageConfig: {
                EntryPoint: ['.entrypoint'],
                Command: [],
              },
              Role: desired.Configuration?.Role,
              Timeout: desired.Configuration?.Timeout,
              MemorySize: desired.Configuration?.MemorySize,
              Environment: desired.Configuration?.Environment,
            }),
          );
        },
      },
      (output) => output?.Configuration,
    ).manage(
      {
        ...options,
        retries: Infinity,
      },
      desired,
    );

    status.functionArn = configuration.FunctionArn;
    status.architecture = configuration.Architectures?.[0];
  }

  private async configureUrl(status: LambdaDeployStatus, options: ResourceOptions): Promise<void> {
    const { functionUrl } = await new CloudResource<
      { functionUrl: string },
      GetFunctionUrlConfigCommandOutput
    >(
      {
        describe: (resource) => {
          return { type: 'Function URL', label: resource.functionUrl };
        },
        read: () =>
          this.lambdaClient.send(
            new GetFunctionUrlConfigCommand({
              FunctionName: status.functionArn,
            }),
          ),
        create: () =>
          this.lambdaClient.send(
            new CreateFunctionUrlConfigCommand({
              FunctionName: status.functionArn,
              AuthType: 'NONE',
              InvokeMode: 'BUFFERED',
            }),
          ),
        update: () =>
          this.lambdaClient.send(
            new UpdateFunctionUrlConfigCommand({
              FunctionName: status.functionArn,
              AuthType: 'NONE',
              InvokeMode: 'BUFFERED',
            }),
          ),
      },
      (output) => {
        return { functionUrl: new URL(output.FunctionUrl || '').origin };
      },
    ).manage(options);

    status.url = functionUrl;
  }

  private async configurePermissions(
    status: DeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    const requests: AddPermissionRequest[] = [
      {
        FunctionName: status.functionArn,
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
        read: () =>
          this.lambdaClient.send(new GetPolicyCommand({ FunctionName: status.functionArn })),
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
    status: LambdaDeployStatus & EcrDeployStatus & DockerDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    const { imageDigest } = status;
    if (!imageDigest) {
      throw new Error('Missing image digest');
    }

    const desired: Partial<GetFunctionCommandOutput> = {
      Code: {
        ImageUri: `${status.repositoryUri}@${imageDigest}`,
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
        read: () =>
          this.lambdaClient.send(new GetFunctionCommand({ FunctionName: status.functionArn })),
        update: () =>
          this.dockerService.getPlatform('match-host').then((platform) =>
            this.lambdaClient.send(
              new UpdateFunctionCodeCommand({
                FunctionName: status.functionArn,
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

    status.imageUri = imageUri;
    // TODO: warn if architecture changes?
    status.architecture = architecture;
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
