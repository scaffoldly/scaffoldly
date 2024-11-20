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
  // eslint-disable-next-line import/named
  GetAliasCommandOutput,
  // eslint-disable-next-line import/named
  AliasConfiguration,
  GetAliasCommand,
  CreateAliasCommand,
  UpdateAliasCommand,
  CreateEventSourceMappingCommand,
  UpdateEventSourceMappingCommand,
  // eslint-disable-next-line import/named
  EventSourceMappingConfiguration,
  ListEventSourceMappingsCommand,
  // eslint-disable-next-line import/named
  ListEventSourceMappingsCommandOutput,
} from '@aws-sdk/client-lambda';
import { IamConsumer, IamDeployStatus, PolicyDocument, TrustRelationship } from './iam';
import { DeployStatus } from '.';
import { CloudResource, ResourceOptions, Subscription } from '..';
import { EnvDeployStatus, EnvProducer, EnvService } from '../../ci/env';
import { DockerDeployStatus, DockerService } from '../docker';
import { Architecture } from '../../ci/docker';
import { EcrDeployStatus } from './ecr';
import { GitDeployStatus, GitService } from '../git';
import { SkipAction } from '../errors';
import { ARN } from './arn';
import { ResourcesDeployStatus } from './resources/resource';
import { join, sep } from 'path';

export type LambdaDeployStatus = {
  functionArn?: string;
  functionVersion?: string;
  functionQualifier?: string;
  architecture?: Architecture;
  imageUri?: string;
  url?: string;
};

export interface SubscriptionProducer {
  get subscriptions(): Promise<Subscription[]>;
}

export class LambdaService implements IamConsumer, EnvProducer {
  lambdaClient: LambdaClient;

  private _url?: string;

  constructor(
    private gitService: GitService,
    private dockerService: DockerService,
    private envService: EnvService,
  ) {
    this.lambdaClient = new LambdaClient();
  }

  public async predeploy(status: LambdaDeployStatus, options: ResourceOptions): Promise<void> {
    await this.configureFunction(status, options);
    await this.configureAlias(status, options);
    await this.configureUrl(status, options);
  }

  public async deploy(
    status: LambdaDeployStatus,
    producers: SubscriptionProducer[],
    options: ResourceOptions,
  ): Promise<void> {
    // TODO: Create Alias for PR branches?
    await this.configureFunction(status, options);
    await this.publishCode(status, options);
    await this.configureAlias(status, options);
    await this.configurePermissions(
      status,
      await this.configureSubscriptions(status, producers, options),
      options,
    );
    await this.configureUrl(status, options);
  }

  private async configureFunction(
    status: LambdaDeployStatus &
      GitDeployStatus &
      IamDeployStatus &
      EcrDeployStatus &
      DockerDeployStatus &
      EnvDeployStatus &
      ResourcesDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev || options.buildOnly) {
      return;
    }

    const { name } = this.gitService.config;

    const desired: Partial<GetFunctionCommandOutput> = {
      Configuration: {
        Role: status.roleArn,
        Timeout: this.gitService.config.timeout,
        MemorySize: this.gitService.config.memorySize,
        VpcConfig: status.vpc
          ? {
              VpcId: status.vpc.vpcId,
              SecurityGroupIds: status.vpc.securityGroupIds,
              SubnetIds: status.vpc.subnetIds,
            }
          : undefined,
        FileSystemConfigs: status.efs
          ? [
              {
                Arn: status.efs.accessPoint,
                LocalMountPath: join(sep, 'mnt', status.efs.fileSystemName || 'efs'),
              },
            ]
          : undefined,
        LastUpdateStatus: 'Successful',
        State: 'Active',
      },
    };

    const { repositoryUri, imageDigest } = status;

    const configuration = await new CloudResource<FunctionConfiguration, GetFunctionCommandOutput>(
      {
        describe: (resource) => {
          return { type: 'Lambda Function', label: resource.FunctionName || name };
        },
        read: () =>
          this.lambdaClient.send(
            new GetFunctionCommand({
              FunctionName: status.functionArn || name,
            }),
          ),
        create: () =>
          this.envService.runtimeEnv.then((runtimeEnv) =>
            this.lambdaClient.send(
              new CreateFunctionCommand({
                Code: {
                  ImageUri: `${repositoryUri}@${imageDigest}`,
                },
                FunctionName: status.functionArn || name,
                Publish: false,
                PackageType: 'Image',
                Architectures:
                  this.dockerService.platform === 'linux/arm64' ? ['arm64'] : ['x86_64'],
                ImageConfig: {
                  EntryPoint: ['.entrypoint'],
                  Command: [],
                },
                Role: desired.Configuration?.Role,
                Timeout: desired.Configuration?.Timeout,
                MemorySize: desired.Configuration?.MemorySize,
                Environment: {
                  Variables: runtimeEnv,
                },
                VpcConfig: desired.Configuration?.VpcConfig,
                FileSystemConfigs: desired.Configuration?.FileSystemConfigs,
              }),
            ),
          ),
        update: (existing) =>
          this.envService.runtimeEnv.then((runtimeEnv) =>
            this.lambdaClient
              .send(
                new UpdateFunctionConfigurationCommand({
                  FunctionName: existing.FunctionArn,
                  ImageConfig: {
                    EntryPoint: ['.entrypoint'],
                    Command: [],
                  },
                  Role: desired.Configuration?.Role,
                  Timeout: desired.Configuration?.Timeout,
                  MemorySize: desired.Configuration?.MemorySize,
                  Environment: {
                    Variables: runtimeEnv,
                  },
                  VpcConfig: desired.Configuration?.VpcConfig,
                  FileSystemConfigs: desired.Configuration?.FileSystemConfigs,
                }),
              )
              .then((updated) => {
                status.functionVersion = updated.Version;
                return updated;
              }),
          ),
        emitPermissions: (aware) => {
          aware.withPermissions([
            'lambda:CreateFunction',
            'lambda:GetFunction',
            'lambda:UpdateFunctionConfiguration',
            'lambda:ListEventSourceMappings',
            'lambda:CreateEventSourceMapping',
            'lambda:UpdateEventSourceMapping',
            'lambda:DeleteEventSourceMapping',
          ]);
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

  private async configureAlias(
    status: LambdaDeployStatus & GitDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev || options.buildOnly) {
      return;
    }

    const { alias } = status;

    const configuration = await new CloudResource<AliasConfiguration, GetAliasCommandOutput>(
      {
        describe: (resource) => {
          return {
            type: 'Function Alias',
            label: `${alias} (version: ${resource.FunctionVersion || '[computed]'})`,
          };
        },
        read: () =>
          this.lambdaClient.send(
            new GetAliasCommand({
              FunctionName: status.functionArn,
              Name: alias,
            }),
          ),
        create: () =>
          this.lambdaClient.send(
            new CreateAliasCommand({
              FunctionName: status.functionArn,
              Name: alias,
              FunctionVersion: status.functionVersion || '$LATEST',
            }),
          ),
        update: () => {
          if (!status.functionVersion) {
            throw new SkipAction('Function Version is unknown');
          }
          if (!status.imageUri) {
            throw new SkipAction('Image URI is unknown');
          }
          return this.lambdaClient.send(
            new UpdateAliasCommand({
              FunctionName: status.functionArn,
              Name: alias,
              FunctionVersion: status.functionVersion,
            }),
          );
        },
        emitPermissions: (aware) => {
          aware.withPermissions(['lambda:CreateAlias', 'lambda:GetAlias', 'lambda:UpdateAlias']);
        },
      },
      (output) => output,
    ).manage(options);

    status.functionQualifier = configuration.Name;
  }

  private async configureUrl(status: LambdaDeployStatus, options: ResourceOptions): Promise<void> {
    if (options.dev || options.buildOnly) {
      return;
    }

    const { functionUrl } = await new CloudResource<
      { functionUrl: string },
      GetFunctionUrlConfigCommandOutput
    >(
      {
        describe: (resource) => {
          return {
            type: 'Function URL',
            label: resource.functionUrl || '[computed]',
          };
        },
        read: () =>
          this.lambdaClient
            .send(
              new GetFunctionUrlConfigCommand({
                FunctionName: status.functionArn,
                Qualifier: status.functionQualifier,
              }),
            )
            .then((output) => {
              this._url = output.FunctionUrl;
              return output;
            }),
        create: () =>
          this.lambdaClient.send(
            new CreateFunctionUrlConfigCommand({
              FunctionName: status.functionArn,
              AuthType: 'NONE',
              InvokeMode: 'RESPONSE_STREAM',
              Qualifier: status.functionQualifier,
            }),
          ),
        update: () =>
          this.lambdaClient.send(
            new UpdateFunctionUrlConfigCommand({
              FunctionName: status.functionArn,
              AuthType: 'NONE',
              InvokeMode: 'RESPONSE_STREAM',
              Qualifier: status.functionQualifier,
            }),
          ),
        emitPermissions: (aware) => {
          aware.withPermissions([
            'lambda:CreateFunctionUrlConfig',
            'lambda:GetFunctionUrlConfig',
            'lambda:UpdateFunctionUrlConfig',
          ]);
        },
      },
      (output) => {
        return { functionUrl: new URL(output.FunctionUrl || '').origin };
      },
    ).manage(options);

    status.url = functionUrl;
  }

  private async configurePermissions(
    status: DeployStatus,
    subscriptions: Subscription[],
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev || options.buildOnly) {
      return;
    }

    const requests: AddPermissionRequest[] = [
      {
        FunctionName: status.functionArn,
        Qualifier: status.functionQualifier,
        StatementId: 'InvokeFunctionUrl',
        Action: 'lambda:InvokeFunctionUrl',
        Principal: '*',
        FunctionUrlAuthType: 'NONE',
      },
      ...(await Promise.all(
        subscriptions
          .map((s) => s.lambdaPermission)
          .filter((fn) => !!fn)
          .map((fn) => fn(`${status.functionArn}:${status.functionQualifier}`)),
      ).then((rs) => rs.filter((r) => !!r))),
    ];

    await new CloudResource<{ policy: PolicyDocument }, GetPolicyCommandOutput>(
      {
        describe: () => {
          return {
            type: 'Function Policies',
            label: requests.map((r) => r.StatementId).join(', '),
          };
        },
        read: () =>
          this.lambdaClient.send(
            new GetPolicyCommand({
              FunctionName: status.functionArn,
              Qualifier: status.functionQualifier,
            }),
          ),
        create: () =>
          Promise.all(
            requests.map((request) => this.lambdaClient.send(new AddPermissionCommand(request))),
          ),
        update: (existing) =>
          Promise.all(
            requests
              .filter(
                (request) =>
                  !existing.policy?.Statement?.find(
                    (statement) => statement.Sid === request.StatementId,
                  ),
              )
              .map((request) => this.lambdaClient.send(new AddPermissionCommand(request))),
          ),
        emitPermissions: (aware) => {
          aware.withPermissions(['lambda:AddPermission', 'lambda:GetPolicy']);
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
    if (options.dev || options.buildOnly) {
      return;
    }

    const { imageDigest } = status;

    const desired: Partial<GetFunctionCommandOutput> = {
      Code: {
        ImageUri: `${status.repositoryUri}@${imageDigest || 'latest'}`,
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
          return {
            type: 'Function Code',
            label: resource.imageUri?.split('/').pop() || '[computed]',
          };
        },
        read: () =>
          this.lambdaClient.send(
            new GetFunctionCommand({
              FunctionName: status.functionArn,
            }),
          ),
        update: () =>
          this.lambdaClient
            .send(
              new UpdateFunctionCodeCommand({
                FunctionName: status.functionArn,
                ImageUri: desired.Code?.ImageUri,
                Architectures:
                  this.dockerService.platform === 'linux/arm64' ? ['arm64'] : ['x86_64'],
                Publish: true,
              }),
            )
            .then((updated) => {
              status.functionVersion = updated.Version;
              return updated;
            }),
        emitPermissions: (aware) => {
          aware.withPermissions([
            'lambda:UpdateFunctionCode',
            'lambda:GetFunction',
            'lambda:InvokeFunction',
          ]);
        },
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

  private async configureSubscriptions(
    status: LambdaDeployStatus,
    producers: SubscriptionProducer[],
    options: ResourceOptions,
  ): Promise<Subscription[]> {
    const subscriptions = (
      await Promise.all(producers.map((producer) => producer.subscriptions))
    ).flat();

    const cloudResources = subscriptions.map((subscription) => {
      if (subscription.createSubscription) {
        return subscription.createSubscription(`${status.functionArn}:${status.functionQualifier}`);
      }

      return new CloudResource<
        EventSourceMappingConfiguration,
        ListEventSourceMappingsCommandOutput
      >(
        {
          describe: (resource) => {
            return {
              type: 'Function Subscription',
              label: resource.EventSourceArn
                ? ARN.resource(resource.EventSourceArn).name
                : '[computed]',
            };
          },
          read: () =>
            this.lambdaClient.send(
              new ListEventSourceMappingsCommand({
                FunctionName: `${status.functionArn}:${status.functionQualifier}`,
              }),
            ),
          create: () =>
            this.lambdaClient.send(
              new CreateEventSourceMappingCommand({
                FunctionName: `${status.functionArn}:${status.functionQualifier}`,
                EventSourceArn: subscription.subscriptionArn,
                StartingPosition: 'LATEST',
                Enabled: true,
              }),
            ),
          update: (existing) =>
            this.lambdaClient.send(
              new UpdateEventSourceMappingCommand({
                UUID: existing.UUID,
                FunctionName: `${status.functionArn}:${status.functionQualifier}`,
                Enabled: !!subscriptions.find((s) => s.subscriptionArn === existing.EventSourceArn),
              }),
            ),
        },
        (output) => {
          if (!output.EventSourceMappings) return undefined;
          if (!output.EventSourceMappings.length) return undefined;
          return output.EventSourceMappings.find(
            (sm) => sm.EventSourceArn === subscription.subscriptionArn,
          );
        },
      );
    });

    await Promise.all(cloudResources.map((cloudResource) => cloudResource.manage(options)));

    return subscriptions;
  }

  get env(): Promise<Record<string, string>> {
    return Promise.resolve({
      URL: this._url || '',
    });
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
            'ec2:CreateNetworkInterface',
            'ec2:DescribeNetworkInterfaces',
            'ec2:DescribeSubnets',
            'ec2:DeleteNetworkInterface',
            'ec2:AssignPrivateIpAddresses',
            'ec2:UnassignPrivateIpAddresses',
          ],
          Resource: ['*'],
          Effect: 'Allow',
        },
      ],
    };
  }
}
