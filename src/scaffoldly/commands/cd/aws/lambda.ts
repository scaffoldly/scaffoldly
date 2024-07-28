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
  FunctionCodeLocation,
  // eslint-disable-next-line import/named
  AddPermissionRequest,
  Architecture,
} from '@aws-sdk/client-lambda';
import { ScaffoldlyConfig } from '../../../../config';
import { IamConsumer, PolicyDocument, TrustRelationship } from './iam';
import promiseRetry from 'promise-retry';
import { ui } from '../../../command';
import _ from 'lodash';
import { DeployStatus } from '.';
import { NotFoundException } from './errors';
import { CloudResource, manageResource, ResourceOptions } from '..';
import { EnvService } from '../env';

export type LambdaDeployStatus = {
  functionArn?: string;
  imageUri?: string;
  origin?: string;
};

export type FunctionResource = CloudResource<
  LambdaClient,
  FunctionConfiguration,
  CreateFunctionCommand,
  UpdateFunctionConfigurationCommand
>;

export type CodeResource = CloudResource<
  LambdaClient,
  FunctionCodeLocation,
  UpdateFunctionCodeCommand,
  undefined
>;

export type PermissionResource = CloudResource<
  LambdaClient,
  AddPermissionRequest,
  AddPermissionCommand,
  undefined
>;

type FunctionUrl = {
  origin: string;
};

export type UrlResource = CloudResource<
  LambdaClient,
  FunctionUrl,
  CreateFunctionUrlConfigCommand,
  undefined
>;

export class LambdaService implements IamConsumer {
  lambdaClient: LambdaClient;

  constructor(private config: ScaffoldlyConfig, private envService: EnvService) {
    this.lambdaClient = new LambdaClient();
  }

  public async predeploy(status: DeployStatus, options: ResourceOptions): Promise<DeployStatus> {
    const lambdaDeployStatus: LambdaDeployStatus = {};

    ui.updateBottomBar('Preparing function');
    const configuration = await manageResource(
      this.functionResource(this.config.name, status),
      options,
    );
    lambdaDeployStatus.functionArn = configuration.FunctionArn;

    ui.updateBottomBar('Setting permissions');
    await manageResource(
      this.permissionResource(this.config.name, 'InvokeFunctionUrl', {
        Action: 'lambda:InvokeFunctionUrl',
        Principal: '*',
        FunctionUrlAuthType: 'NONE',
      }),
      options,
    );

    ui.updateBottomBar(`Updating URL`);
    const { origin } = await manageResource(this.urlResource(this.config.name), options);
    lambdaDeployStatus.origin = origin;

    return { ...status, ...lambdaDeployStatus };
  }

  public async deploy(status: DeployStatus, options: ResourceOptions): Promise<DeployStatus> {
    const lambdaStatus: LambdaDeployStatus = {};

    ui.updateBottomBar('Updating Lambda function');
    const configuration = await manageResource(
      this.functionResource(this.config.name, status),
      options,
    );
    lambdaStatus.functionArn = configuration.FunctionArn;

    const code = await manageResource(this.codeResource(this.config.name, status), options);
    lambdaStatus.imageUri = code.ImageUri;

    return { ...status, ...lambdaStatus };
  }

  private functionResource(name: string, status: DeployStatus): FunctionResource {
    type MutableFields = {
      roleArn: string;
      timeout: number;
      memorySize: number;
    };

    let { repositoryUri, imageDigest } = status;
    if (!repositoryUri || !imageDigest) {
      // Use the Hello World Image if either is unknown, it's the initial deploy
      // TODO: multi-platform builds for hello world
      repositoryUri = '557208059266.dkr.ecr.us-east-1.amazonaws.com/scaffoldly-hello-world';
      imageDigest = 'sha256:3b5a30e673defa489f2bbb0ed36b558dd22ecc866eaa37a1b81713e32d55560c';
    }

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

    const { roleArn } = status;

    if (!roleArn) {
      throw new Error('Missing role ARN');
    }

    const desired: MutableFields = {
      roleArn,
      timeout: 30,
      memorySize: 1024,
    };

    const read = () =>
      promiseRetry(
        (retry) =>
          this.lambdaClient
            .send(new GetFunctionCommand({ FunctionName: name }))
            .then((response) => {
              if (!response.Configuration) {
                throw new NotFoundException('Function configuration not found');
              }

              const actual: Partial<MutableFields> = {
                roleArn: response.Configuration.Role,
                timeout: response.Configuration.Timeout,
                memorySize: response.Configuration.MemorySize,
              };

              if (
                response.Configuration.Architectures &&
                response.Configuration.Architectures.length &&
                response.Configuration.Architectures[0] !== architectures[0]
              ) {
                return retry(
                  new Error(
                    `Configured architecture ${response.Configuration.Architectures[0]} is immutable.`,
                  ),
                );
              }

              if (!_.isEqual(actual, desired)) {
                return retry(
                  new Error(
                    `Timed out waiting for ${name} to update with configuration: ${JSON.stringify(
                      desired,
                    )}`,
                  ),
                );
              }
              if (response.Configuration.LastUpdateStatus !== 'Successful') {
                return retry(new Error(`Timed out waiting for ${name} update to be successful.`));
              }
              if (response.Configuration.State !== 'Active') {
                return retry(new Error(`Timed out waiting for ${name} to become active.`));
              }

              return response.Configuration;
            })
            .catch((e) => {
              if (e.name === 'ResourceNotFoundException') {
                throw new NotFoundException('Function not found', e);
              }
              throw e;
            }),
        { factor: 1, retries: 60 },
      );

    return {
      client: this.lambdaClient,
      read,
      create: async (command) =>
        // Using retry b/c of Role creation race condition
        promiseRetry((retry) => this.lambdaClient.send(command).catch(retry)).then(read),
      update: async (command) => this.lambdaClient.send(command).then(read),
      request: {
        create: new CreateFunctionCommand({
          Code: {
            ImageUri: `${repositoryUri}@${imageDigest}`,
          },
          ImageConfig: {
            EntryPoint: status.entrypoint,
            Command: [],
          },
          FunctionName: name,
          Role: desired.roleArn,
          Publish: false,
          PackageType: 'Image',
          Timeout: desired.timeout,
          MemorySize: desired.memorySize,
          Architectures: architectures,
          Environment: {
            Variables: {
              ...this.envService.runtimeEnv,
              // Disable version checking in config since we're deploying hello world image
              // This is so we can deploy a function and generate a Function URL without needing a build first
              // TODO: Remove this crap
              SLY_SERVE: this.config.serveCommands.encode(false),
              SLY_STRICT: 'false',
            },
          },
        }),
        update: new UpdateFunctionConfigurationCommand({
          FunctionName: name,
          Role: desired.roleArn,
          Timeout: desired.timeout,
          MemorySize: desired.memorySize,
          Environment: {
            Variables: this.envService.runtimeEnv,
          },
          ImageConfig: {
            EntryPoint: status.entrypoint,
            Command: [],
          },
        }),
      },
    };
  }

  private codeResource(name: string, status: DeployStatus): CodeResource {
    type MutableFields = {
      imageUri: string;
    };

    const { repositoryUri, imageDigest } = status;
    if (!repositoryUri) {
      throw new Error('Missing repository URI');
    }
    if (!imageDigest) {
      throw new Error('Missing image digest');
    }

    const desired: MutableFields = {
      imageUri: `${repositoryUri}@${imageDigest}`,
    };

    const read = () =>
      promiseRetry(
        (retry) =>
          this.lambdaClient
            .send(new GetFunctionCommand({ FunctionName: name }))
            .then((response) => {
              if (!response.Code) {
                throw new NotFoundException('Function code not found');
              }

              if (!response.Configuration) {
                throw new NotFoundException('Function configuration not found');
              }

              const actual: Partial<MutableFields> = {
                imageUri: response.Code.ImageUri,
              };

              if (!_.isEqual(actual, desired)) {
                return retry(
                  new Error(`Timed out waiting for ${name} to update code configuration`),
                );
              }

              // TODO make this a helper function
              if (response.Configuration.LastUpdateStatus !== 'Successful') {
                return retry(new Error(`Timed out waiting for ${name} update to be successful.`));
              }
              if (response.Configuration.State !== 'Active') {
                return retry(new Error(`Timed out waiting for ${name} to become active.`));
              }

              return response.Code;
            })
            .catch((e) => {
              if (e.name === 'ResourceNotFoundException') {
                throw new NotFoundException('Function not found', e);
              }
              throw e;
            }),
        { factor: 1, retries: 60 },
      );

    return {
      client: this.lambdaClient,
      read,
      create: async (command: UpdateFunctionCodeCommand) => {
        if (!command) {
          return read();
        }
        return promiseRetry((retry) => this.lambdaClient.send(command).catch(retry).then(read), {
          factor: 1,
          retries: 60,
        });
      },
      update: read,
      request: {
        create: new UpdateFunctionCodeCommand({
          FunctionName: name,
          ImageUri: desired.imageUri,
          Publish: true,
        }),
      },
    };
  }

  private permissionResource(
    functionName: string,
    permissionName: string,
    permission: Partial<AddPermissionRequest>,
  ): PermissionResource {
    if (!permission.Principal) {
      throw new Error('Missing principal in permission');
    }
    if (!permission.Action) {
      throw new Error('Missing action in permission');
    }
    const permissionRequest: AddPermissionRequest = {
      ...permission,
      FunctionName: functionName,
      StatementId: permissionName,
      Principal: permission.Principal,
      Action: permission.Action,
    };

    const read = () => {
      // TODO: Find API to fetch permissions
      return Promise.resolve(permissionRequest);
    };

    return {
      client: this.lambdaClient,
      read,
      create: async (command: AddPermissionCommand) => {
        return this.lambdaClient
          .send(command)
          .catch((e) => {
            if (e.name === 'ResourceConflictException') {
              return read();
            }
            throw e;
          })
          .then(read);
      },
      update: read,
      request: {
        create: new AddPermissionCommand({
          ...permissionRequest,
          FunctionName: functionName,
          StatementId: permissionName,
        }),
      },
    };
  }

  private urlResource(name: string): UrlResource {
    const read = () =>
      this.lambdaClient
        .send(new GetFunctionUrlConfigCommand({ FunctionName: name }))
        .then((response) => {
          if (!response.FunctionUrl) {
            throw new NotFoundException('Function URL not found');
          }
          const url = new URL(response.FunctionUrl);
          return { origin: url.origin } as FunctionUrl;
        })
        .catch((e) => {
          if (e.name === 'ResourceNotFoundException') {
            throw new NotFoundException('Function URL not found', e);
          }
          throw e;
        });

    return {
      client: this.lambdaClient,
      read,
      create: async (command: CreateFunctionUrlConfigCommand) => {
        return this.lambdaClient
          .send(command)
          .catch((e) => {
            if (e.name === 'ResourceConflictException') {
              return read();
            }
            throw e;
          })
          .then(read);
      },
      update: read,
      request: {
        create: new CreateFunctionUrlConfigCommand({
          AuthType: 'NONE', // TODO: Make configurable
          FunctionName: name,
          InvokeMode: 'BUFFERED', // TODO: Make configurable
        }),
      },
    };
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
            'secretsmanager:GetSecretValue', // TODO: Reduce to just the managed secret
          ],
          Resource: ['*'],
          Effect: 'Allow',
        },
      ],
    };
  }
}
