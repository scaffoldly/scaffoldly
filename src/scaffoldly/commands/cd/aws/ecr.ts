import {
  ECRClient,
  CreateRepositoryCommand,
  DescribeRepositoriesCommand,
  GetAuthorizationTokenCommand,
  // eslint-disable-next-line import/named
  Repository,
  // eslint-disable-next-line import/named
  AuthorizationData,
} from '@aws-sdk/client-ecr';
import { ui } from '../../../command';
import { ScaffoldlyConfig } from '../../../../config';
import { AuthConfig } from 'dockerode';
import { CloudResource, manageResource, ResourceOptions } from '..';
import {} from '@smithy/types';
import { NotFoundException } from './errors';
import { DeployStatus } from '.';
import { Architecture, DockerService } from '../docker';

export type EcrDeployStatus = {
  architecture?: Architecture;
  repositoryUri?: string;
};

export type RepositoryResource = CloudResource<
  ECRClient,
  Repository,
  CreateRepositoryCommand,
  undefined,
  undefined
>;

export type AuthorizationDataResource = CloudResource<
  ECRClient,
  AuthorizationData,
  CreateRepositoryCommand,
  undefined,
  undefined
>;

export interface RegistryAuthConsumer {
  get authConfig(): Promise<AuthConfig>;
}

export class EcrService implements RegistryAuthConsumer {
  ecrClient: ECRClient;

  constructor(private config: ScaffoldlyConfig, private dockerService: DockerService) {
    this.ecrClient = new ECRClient();
  }

  public async predeploy(status: DeployStatus, options: ResourceOptions): Promise<DeployStatus> {
    const ecrDeployStatus: EcrDeployStatus = {};

    ui.updateBottomBar('Creating ECR repository');
    const { repository } = await this.manageEcrRepository(options);

    const { repositoryUri } = repository;
    ecrDeployStatus.repositoryUri = repositoryUri;

    ui.updateBottomBar('Determining architecture');
    const architecture = await this.dockerService.architecture;
    ecrDeployStatus.architecture = architecture;

    return { ...status, ...ecrDeployStatus };
  }

  private repositoryResource(name: string): RepositoryResource {
    const read = () =>
      this.ecrClient
        .send(new DescribeRepositoriesCommand({ repositoryNames: [name] }))
        .then((response) => {
          if (!response.repositories || response.repositories.length === 0) {
            throw new NotFoundException('Repository not found');
          }

          return response.repositories[0];
        });

    return {
      client: this.ecrClient,
      read,
      create: async (command) => this.ecrClient.send(command).then(read),
      update: read,
      request: {
        create: new CreateRepositoryCommand({ repositoryName: this.config.name }),
      },
    };
  }

  private async manageEcrRepository(options: ResourceOptions): Promise<{ repository: Repository }> {
    const { name } = this.config;
    if (!name) {
      throw new Error('Missing name');
    }

    const repository = await manageResource(this.repositoryResource(name), options);

    if (!repository) {
      throw new Error('Failed to create repository');
    }

    return { repository };
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
