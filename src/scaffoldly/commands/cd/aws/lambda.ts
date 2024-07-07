import {
  AddPermissionCommand,
  CreateFunctionCommand,
  CreateFunctionUrlConfigCommand,
  GetFunctionCommand,
  GetFunctionUrlConfigCommand,
  LambdaClient,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
} from '@aws-sdk/client-lambda';
import { ScaffoldlyConfig } from '../../../../config';
import { IamService, PolicyDocument, TrustRelationship } from './iam';
import { EcrService } from './ecr';
import { DockerService } from '../../ci/docker';
import promiseRetry from 'promise-retry';
import { ui } from '../../../command';
import _ from 'lodash';

export class LambdaService {
  lambdaClient: LambdaClient;

  iamService: IamService;

  ecrService: EcrService;

  constructor(private dockerService: DockerService, private config: ScaffoldlyConfig) {
    this.iamService = new IamService(this.config);
    this.ecrService = new EcrService(this.config);
    this.lambdaClient = new LambdaClient({
      region: 'us-east-1', // TODO check why env var is not being used
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
          ],
          Resource: ['*'],
          Effect: 'Allow',
        },
      ],
    };
  }

  public async deploy(): Promise<void> {
    ui.updateBottomBar('Creating ECR repository');
    const { authConfig, repositoryUri } = await this.ecrService.getOrCreateEcrRepository();

    ui.updateBottomBar('Building image');
    const { imageName } = await this.dockerService.build(this.config, 'build', repositoryUri);

    ui.updateBottomBar('Pushing image');
    const { imageDigest, architecture } = await this.dockerService.push(imageName, authConfig);

    ui.updateBottomBar(`Creating IAM role`);
    const { roleArn } = await this.iamService.getOrCreateIamRole(
      this.trustRelationship,
      this.policyDocument,
    );

    ui.updateBottomBar(`Deploying function`);
    const { functionArn } = await this.getOrCreateLambdaFunction(
      repositoryUri,
      imageDigest,
      roleArn,
      architecture,
    );

    ui.updateBottomBar('Setting permissions');
    await this.setPermissions();

    ui.updateBottomBar(`Creating function URL`);
    const { url } = await this.getOrCreateFunctionUrl();
    ui.updateBottomBar('');

    const status = {
      repositoryUri,
      imageDigest,
      architecture,
      roleArn,
      functionArn,
      url,
    };
    console.table(status);
    console.log('🚀 Deployment Complete!');
  }

  private async getOrCreateLambdaFunction(
    repositoryUri: string,
    imageDigest: string,
    roleArn: string,
    architecture: string,
  ): Promise<{ functionArn: string }> {
    const { name } = this.config;

    const desiredConfig = {
      role: roleArn,
      timeout: 30,
      memorySize: 1024,
    };

    const { functionArn } = await promiseRetry(
      async (retry) => {
        return this.lambdaClient
          .send(new GetFunctionCommand({ FunctionName: name }))
          .then((response) => {
            return {
              functionArn: response.Configuration?.FunctionArn,
              state: response.Configuration?.State,
              status: response.Configuration?.LastUpdateStatus,
              actualConfig: {
                role: response.Configuration?.Role,
                timeout: response.Configuration?.Timeout,
                memorySize: response.Configuration?.MemorySize,
              },
            };
          })
          .catch(async (e) => {
            if (e.name === 'ResourceNotFoundException') {
              const response = await this.lambdaClient.send(
                new CreateFunctionCommand({
                  Code: {
                    ImageUri: `${repositoryUri}@${imageDigest}`,
                  },
                  FunctionName: name,
                  Role: roleArn,
                  Publish: false,
                  PackageType: 'Image',
                  Timeout: 30,
                  MemorySize: 1024,
                  Architectures: [architecture === 'arm64' ? 'arm64' : 'x86_64'],
                }),
              );
              return {
                functionArn: response.FunctionArn,
                state: response.State,
                status: response.LastUpdateStatus,
                actualConfig: {
                  role: response.Role,
                  timeout: response.Timeout,
                  memorySize: response.MemorySize,
                },
              };
            }
            throw e;
          })
          .then(async (response) => {
            if (_.isEqual(response.actualConfig, desiredConfig)) {
              return response;
            }

            const updated = await this.lambdaClient.send(
              new UpdateFunctionConfigurationCommand({
                FunctionName: name,
                Role: roleArn,
                Timeout: 30,
                MemorySize: 1024,
              }),
            );
            return {
              functionArn: updated.FunctionArn,
              state: updated.State,
              status: updated.LastUpdateStatus,
              actualConfig: {
                role: updated.Role,
                timeout: updated.Timeout,
                memorySize: updated.MemorySize,
              },
            };
          })
          .then((response) => {
            if (!_.isEqual(response.actualConfig, desiredConfig)) {
              return retry(
                new Error(
                  `Timed out waiting for ${name} to update with configuration ${desiredConfig}`,
                ),
              );
            }
            if (response.status !== 'Successful') {
              return retry(new Error(`Timed out waiting for ${name} update to be successful.`));
            }
            if (response.state !== 'Active') {
              return retry(new Error(`Timed out waiting for ${name} to become active.`));
            }
            return response;
          });
      },
      { factor: 1, retries: 60 },
    );

    if (!functionArn) {
      throw new Error('Failed to create function');
    }

    const imageUri = `${repositoryUri}@${imageDigest}`;

    await this.lambdaClient
      .send(
        new UpdateFunctionCodeCommand({
          FunctionName: name,
          ImageUri: imageUri,
          Publish: true,
        }),
      )
      .then((response) => response.RevisionId);

    await promiseRetry(
      async (retry) => {
        return this.lambdaClient
          .send(new GetFunctionCommand({ FunctionName: name }))
          .then((response) => {
            if (response.Configuration?.State !== 'Active') {
              return retry(new Error(`Timed out waiting for ${name} to become active.`));
            }
            if (response.Configuration.LastUpdateStatus !== 'Successful') {
              return retry(new Error(`Timed out waiting for ${name} to update successfully.`));
            }
            if (response.Code?.ImageUri !== imageUri) {
              return retry(
                new Error(`Timed out waiting for ${name} to update with correct image URI.`),
              );
            }
            return response.Code?.ResolvedImageUri;
          });
      },
      { factor: 1, retries: 60 },
    );

    return { functionArn };
  }

  private async setPermissions(): Promise<void> {
    const { name } = this.config;
    if (!name) {
      throw new Error('Missing name');
    }

    await this.lambdaClient
      .send(
        new AddPermissionCommand({
          Action: 'lambda:InvokeFunctionUrl',
          FunctionName: name,
          Principal: '*',
          StatementId: 'InvokeFunctionUrl',
          FunctionUrlAuthType: 'NONE',
        }),
      )
      .catch(() => {
        // TODO: decide what to do here...
      });
  }

  private async getOrCreateFunctionUrl(): Promise<{ url: string }> {
    const { name } = this.config;
    if (!name) {
      throw new Error('Missing name');
    }
    const functionUrl = await this.lambdaClient
      .send(
        new GetFunctionUrlConfigCommand({
          FunctionName: this.config.name,
        }),
      )
      .then((response) => {
        return response.FunctionUrl;
      })
      .catch(async (e) => {
        if (e.name === 'ResourceNotFoundException') {
          return this.lambdaClient
            .send(
              new CreateFunctionUrlConfigCommand({
                AuthType: 'NONE',
                FunctionName: this.config.name,
                InvokeMode: 'BUFFERED',
              }),
            )
            .then((response) => {
              return response.FunctionUrl;
            });
        }
        throw e;
      });

    if (!functionUrl) {
      throw new Error('Failed to create function url');
    }

    return { url: functionUrl };
  }
}
