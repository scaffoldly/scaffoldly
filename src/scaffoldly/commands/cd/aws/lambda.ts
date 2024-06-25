import {
  CreateFunctionCommand,
  GetFunctionCommand,
  LambdaClient,
  UpdateFunctionCodeCommand,
} from '@aws-sdk/client-lambda';
import { ScaffoldlyConfig } from '../../../../config';
import { IamService, PolicyDocument, TrustRelationship } from './iam';
import { EcrService } from './ecr';
import { DockerService } from '../../ci/docker';
import promiseRetry from 'promise-retry';

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

  public async deploy() {
    const { authConfig, repositoryUri } = await this.ecrService.getOrCreateEcrRepository();
    const { imageName } = await this.dockerService.build(this.config, 'build', repositoryUri);
    const { imageDigest, architecture } = await this.dockerService.push(imageName, authConfig);
    const { roleArn } = await this.iamService.getOrCreateIamRole(
      this.trustRelationship,
      this.policyDocument,
    );
    await this.getOrCreateLambdaFunction(repositoryUri, imageDigest, roleArn, architecture);
  }

  public async getOrCreateLambdaFunction(
    repositoryUri: string,
    imageDigest: string,
    roleArn: string,
    architecture: string,
  ) {
    const { name } = this.config;

    let { functionArn, revisionId } = await promiseRetry(
      async (retry) => {
        return await this.lambdaClient
          .send(new GetFunctionCommand({ FunctionName: name }))
          .then((response) => {
            return {
              functionArn: response.Configuration?.FunctionArn,
              revisionId: response.Configuration?.RevisionId,
              state: response.Configuration?.State,
            };
          })
          .catch(async (e) => {
            if (e.name === 'ResourceNotFoundException') {
              const response = await this.lambdaClient.send(
                // TODO: UpdateFunctionConfigurationCommand
                new CreateFunctionCommand({
                  Code: {
                    ImageUri: `${repositoryUri}@${imageDigest}`,
                  },
                  ImageConfig: {},
                  FunctionName: name,
                  Role: roleArn,
                  Publish: false,
                  PackageType: 'Image',
                  Timeout: 30,
                  Architectures: [architecture === 'arm64' ? 'arm64' : 'x86_64'],
                }),
              );
              return {
                functionArn: response.FunctionArn,
                revisionId: response.RevisionId,
                state: response.State,
              };
            }
            throw e;
          })
          .then((response) => {
            if (response.state !== 'Active') {
              return retry(new Error(`Timed out waiting for ${name} to become active.`));
            }
            return response;
          });
      },
      { factor: 2, randomize: true },
    );

    console.log(`Created function ${name} with ARN: ${functionArn}`);
    const imageUri = `${repositoryUri}@${imageDigest}`;

    revisionId = await this.lambdaClient
      .send(
        new UpdateFunctionCodeCommand({
          FunctionName: name,
          ImageUri: imageUri,
          RevisionId: revisionId,
          Publish: true,
        }),
      )
      .then((response) => response.RevisionId);

    console.log(`Updated function ${name} to image URI: ${imageUri}`);

    const resolvedImageUri = await promiseRetry(
      async (retry) => {
        return await this.lambdaClient
          .send(new GetFunctionCommand({ FunctionName: name }))
          .then((response) => {
            if (response.Configuration?.State !== 'Active') {
              // console.log('!!! bad state'); // TODO good bottom bar
              return retry(new Error(`Timed out waiting for ${name} to become active.`));
            }
            if (response.Configuration.LastUpdateStatus !== 'Successful') {
              // console.log('!!! bad update status'); // TODO good bottom bar
              return retry(new Error(`Timed out waiting for ${name} to update successfully.`));
            }
            if (response.Code?.ImageUri !== imageUri) {
              // console.log('!!! bad image uri');
              return retry(
                new Error(`Timed out waiting for ${name} to update with correct image URI.`),
              );
            }
            return response.Code?.ResolvedImageUri;
          });
      },
      { factor: 2, randomize: true },
    );

    console.log(`Updated function ${name} to ${resolvedImageUri}`);
  }
}
