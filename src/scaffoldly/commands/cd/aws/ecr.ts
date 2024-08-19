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
import { ScaffoldlyConfig } from '../../../../config';
import { AuthConfig } from 'dockerode';
import { CloudResource, ResourceOptions } from '..';
import {} from '@smithy/types';
import { NotFoundException } from './errors';

export type EcrDeployStatus = {
  repositoryUri?: string;
};

export interface RegistryAuthConsumer {
  get authConfig(): Promise<AuthConfig>;
}

export class EcrService implements RegistryAuthConsumer {
  ecrClient: ECRClient;

  constructor(private config: ScaffoldlyConfig) {
    this.ecrClient = new ECRClient();
  }

  public async predeploy(status: EcrDeployStatus, options: ResourceOptions): Promise<void> {
    const { name } = this.config;

    const repository = await new CloudResource<Repository, DescribeRepositoriesCommandOutput>(
      {
        describe: (resource) => {
          return { type: 'ECR Repository', label: resource.repositoryName };
        },
        read: () =>
          this.ecrClient.send(new DescribeRepositoriesCommand({ repositoryNames: [name] })),
        create: () => this.ecrClient.send(new CreateRepositoryCommand({ repositoryName: name })),
      },
      (output) => {
        return (output.repositories || []).find((r) => r.repositoryName === name);
      },
    ).manage(options);

    status.repositoryUri = repository.repositoryUri;
  }

  get authConfig(): Promise<AuthConfig> {
    return this.ecrClient.send(new GetAuthorizationTokenCommand({})).then((response) => {
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
    });
  }
}
