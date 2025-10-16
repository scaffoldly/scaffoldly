import {
  ECRClient,
  CreateRepositoryCommand,
  DescribeRepositoriesCommand,
  GetAuthorizationTokenCommand,
  // eslint-disable-next-line import/named
  Repository,
  // eslint-disable-next-line import/named
  DescribeRepositoriesCommandOutput,
} from '@aws-sdk/client-ecr';
import { AuthConfig } from 'dockerode';
import { CloudResource, ResourceOptions } from '..';
import {} from '@smithy/types';
import { NotFoundException } from '../errors';
import { GitService } from '../git';
import { IamConsumer, IdentityStatus, PolicyDocument } from './iam';
import { EnvProducer } from '../../ci/env';

export type EcrDeployStatus = {
  registry?: string;
  repositoryUri?: string;
};

export interface RegistryAuthConsumer {
  get authConfig(): Promise<AuthConfig>;
}

export class EcrService implements RegistryAuthConsumer, EnvProducer, IamConsumer {
  ecrClient: ECRClient;

  _registry?: string;

  _repositoryUri?: string;

  constructor(private gitService: GitService) {
    this.ecrClient = new ECRClient();
  }

  get env(): Promise<Record<string, string>> {
    const env: Record<string, string> = {};
    if (this._registry) {
      env.AWS_ECR_REGISTRY = this._registry;
      env.ROWDY_REGISTRY = this._registry;
    }
    return Promise.resolve(env);
  }

  public async predeploy(
    status: IdentityStatus & EcrDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev || options.buildOnly) {
      return;
    }

    const { name } = this.gitService.config;
    const registry = `${status.accountId}.dkr.ecr.${status.region}.amazonaws.com`;

    const repository = await new CloudResource<Repository, DescribeRepositoriesCommandOutput>(
      {
        describe: (resource) => {
          return {
            type: 'ECR Repository',
            label: resource.repositoryUri || `${registry}/${name}`,
          };
        },
        read: () =>
          this.ecrClient.send(new DescribeRepositoriesCommand({ repositoryNames: [name] })),
        create: () => this.ecrClient.send(new CreateRepositoryCommand({ repositoryName: name })),
        emitPermissions: (aware) => {
          aware.withPermissions(['ecr:*']);
        },
      },
      (output) => {
        return (output.repositories || []).find((r) => r.repositoryName === name);
      },
    ).manage(options);

    status.registry = this._registry = registry;
    status.repositoryUri = this._repositoryUri = repository.repositoryUri;
  }

  get authConfig(): Promise<AuthConfig> {
    return this.ecrClient
      .send(new GetAuthorizationTokenCommand({}))
      .then((response) => {
        if (!response.authorizationData || response.authorizationData.length === 0) {
          throw new NotFoundException('Repository not found');
        }

        const [authorizationData] = response.authorizationData;
        if (!authorizationData) {
          throw new NotFoundException('Unable to get authorization data from ECR');
        }

        const { authorizationToken, proxyEndpoint } = authorizationData;
        if (!authorizationToken) {
          throw new NotFoundException('Unable to get authorization token from ECR');
        }

        if (!proxyEndpoint) {
          throw new NotFoundException('Unable to get proxy endpoint from ECR');
        }

        const [username, password] = Buffer.from(authorizationToken, 'base64')
          .toString('utf-8')
          .split(':');

        return {
          username,
          password,
          serveraddress: proxyEndpoint,
        };
      })
      .catch((e) => {
        if (!(e instanceof Error)) {
          throw e;
        }
        if (e.name === 'CredentialsProviderError') {
          return {};
        }
        throw e;
      });
  }

  get trustRelationship(): undefined {
    return undefined;
  }

  get policyDocument(): PolicyDocument {
    const document: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['ecr:*'],
          Resource: ['*'],
        },
      ],
    };

    return document;
  }
}
