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
} from '@aws-sdk/client-lambda';
import { ScaffoldlyConfig } from '../../../../config';
import { IamConsumer, PolicyDocument, TrustRelationship } from './iam';
import promiseRetry from 'promise-retry';
import { ui } from '../../../command';
import _ from 'lodash';
import { DeployStatus } from '.';
import { NotFoundException } from './errors';
import { CloudResource, manageResource, ResourceOptions } from '..';
import { config as dotenv } from 'dotenv';
import { Cwd } from '../..';
import { join } from 'path';

export type LambdaDeployStatus = {
  functionArn?: string;
  imageUri?: string;
  url?: string;
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

type FunctionUrl = string;

export type UrlResource = CloudResource<
  LambdaClient,
  FunctionUrl,
  CreateFunctionUrlConfigCommand,
  undefined
>;

export class LambdaService implements IamConsumer {
  lambdaClient: LambdaClient;

  constructor(private cwd: Cwd, private config: ScaffoldlyConfig) {
    this.lambdaClient = new LambdaClient();
  }

  public async deploy(status: DeployStatus, options: ResourceOptions): Promise<LambdaDeployStatus> {
    const lambdaStatus: LambdaDeployStatus = {};

    ui.updateBottomBar('Creating Lambda function');
    const configuration = await manageResource(
      this.functionResource(this.config.name, status),
      options,
    );
    lambdaStatus.functionArn = configuration.FunctionArn;

    const code = await manageResource(this.codeResource(this.config.name, status), options);
    lambdaStatus.imageUri = code.ImageUri;

    ui.updateBottomBar('Setting permissions');
    await manageResource(
      this.permissionResource(this.config.name, 'InvokeFunctionUrl', {
        Action: 'lambda:InvokeFunctionUrl',
        Principal: '*',
        FunctionUrlAuthType: 'NONE',
      }),
      options,
    );

    ui.updateBottomBar(`Creating function URL`);
    const url = await manageResource(this.urlResource(this.config.name), options);
    lambdaStatus.url = url;

    return lambdaStatus;
  }

  private functionResource(name: string, status: DeployStatus): FunctionResource {
    type MutableFields = {
      roleArn: string;
      timeout: number;
      memorySize: number;
    };

    const { repositoryUri, imageDigest, roleArn, architecture } = status;
    if (!repositoryUri) {
      throw new Error('Missing repository URI');
    }
    if (!imageDigest) {
      throw new Error('Missing image digest');
    }
    if (!roleArn) {
      throw new Error('Missing role ARN');
    }
    if (!architecture) {
      throw new Error('Missing architecture');
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

              if (!_.isEqual(actual, desired)) {
                return retry(
                  new Error(`Timed out waiting for ${name} to update with configuration`),
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

    const SLY_SERVE = this.config.serveCommands.encode();
    const SLY_ROUTES = JSON.stringify(this.config.routes); // TODO: Properly encode this

    const env = {
      SLY_ROUTES,
      SLY_SERVE,
      SLY_SECRET: status.secretName || '',
    };

    dotenv({ path: join(this.cwd, '.env'), processEnv: env });

    return {
      client: this.lambdaClient,
      read,
      create: async (command) =>
        promiseRetry((retry) => this.lambdaClient.send(command).catch(retry).then(read), {
          factor: 1,
          retries: 60,
        }),
      update: async (command) =>
        promiseRetry((retry) => this.lambdaClient.send(command).catch(retry).then(read), {
          factor: 1,
          retries: 60,
        }),
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
          Architectures: [architecture === 'arm64' ? 'arm64' : 'x86_64'],
          Environment: {
            Variables: env,
          },
        }),
        update: new UpdateFunctionConfigurationCommand({
          FunctionName: name,
          Role: desired.roleArn,
          Timeout: desired.timeout,
          MemorySize: desired.memorySize,
          Environment: {
            Variables: env,
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
          return response.FunctionUrl;
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
