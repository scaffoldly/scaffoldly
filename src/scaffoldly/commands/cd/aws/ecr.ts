import {
  ECRClient,
  CreateRepositoryCommand,
  DescribeRepositoriesCommand,
  GetAuthorizationTokenCommand,
} from '@aws-sdk/client-ecr';
import { RepositoryNotFoundException } from './errors';
import { ScaffoldlyConfig } from '../../../../config';
import { AuthConfig } from 'dockerode';

export class EcrService {
  ecrClient: ECRClient;

  constructor(private config: ScaffoldlyConfig) {
    this.ecrClient = new ECRClient();
  }

  public async getOrCreateEcrRepository(): Promise<{
    repositoryArn: string;
    repositoryUri: string;
    authConfig: AuthConfig;
  }> {
    const { name } = this.config;
    if (!name) {
      throw new Error('Missing name');
    }

    const { repositoryArn, repositoryUri } = await this.ecrClient
      .send(new DescribeRepositoriesCommand({ repositoryNames: [name] }))
      .then((response) => {
        if (response.repositories && response.repositories.length > 0) {
          return {
            repositoryArn: response.repositories[0].repositoryArn,
            repositoryUri: response.repositories[0].repositoryUri,
          };
        }
        throw new RepositoryNotFoundException();
      })
      .catch(async (e) => {
        if (e.name === 'RepositoryNotFoundException') {
          return this.ecrClient
            .send(new CreateRepositoryCommand({ repositoryName: name }))
            .then((response) => {
              return {
                repositoryArn: response.repository?.repositoryArn,
                repositoryUri: response.repository?.repositoryUri,
              };
            });
        }
        throw e;
      });

    if (!repositoryArn || !repositoryUri) {
      throw new Error('Failed to create repository');
    }

    const authConfig = await this.ecrClient
      .send(new GetAuthorizationTokenCommand({}))
      .then((response) => {
        if (response.authorizationData && response.authorizationData.length > 0) {
          const { authorizationToken, proxyEndpoint } = response.authorizationData[0];
          if (!authorizationToken) {
            throw new Error('Authorization token missing in authorization data');
          }
          const [username, password] = Buffer.from(authorizationToken, 'base64')
            .toString('utf-8')
            .split(':');
          return {
            username,
            password,
            serveraddress: proxyEndpoint,
          } as AuthConfig;
        }
        throw new Error('Failed to get ECR authorization token');
      });

    return { repositoryArn, repositoryUri, authConfig };
  }
}
