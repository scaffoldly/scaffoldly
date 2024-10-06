import { BuildInfo, DockerService as DockerCiService, PushInfo } from '../../ci/docker';
import { CloudResource, ResourceOptions } from '..';
import { EcrDeployStatus, RegistryAuthConsumer } from '../aws/ecr';
import { LambdaDeployStatus } from '../aws/lambda';
import { EnvDeployStatus } from '../../ci/env';
import { GitService } from '../git';
import Dockerode from 'dockerode';

export type Platform = 'linux/amd64' | 'linux/arm64';

export type DockerDeployStatus = {
  imageTag?: string;
  imageName?: string;
  imageDigest?: string;
  imageSize?: number;
};

export class DockerService {
  constructor(private gitService: GitService, public dockerCiService: DockerCiService) {}

  get platform(): Platform {
    return this.dockerCiService.platform;
  }

  public async predeploy(
    status: EcrDeployStatus & DockerDeployStatus,
    consumer: RegistryAuthConsumer,
    options: ResourceOptions,
  ): Promise<void> {
    // Do an initial push to get a valid image digest
    await this.push(status, consumer, options);
  }

  public async deploy(
    status: DockerDeployStatus & EcrDeployStatus & EnvDeployStatus & LambdaDeployStatus,
    consumer: RegistryAuthConsumer,
    options: ResourceOptions,
  ): Promise<void> {
    await this.build(status, options);
    await this.push(status, consumer, options);
  }

  async build(
    status: DockerDeployStatus & EcrDeployStatus & EnvDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    const { imageName, imageTag, imageSize } = await new CloudResource<BuildInfo, BuildInfo>(
      {
        describe: (resource) => {
          return { type: 'Local Image', label: resource.imageName || '[computed]' };
        },
        read: () => {
          return this.dockerCiService.describeBuild(this.gitService.config);
        },
        update: () => {
          return this.dockerCiService.build(
            this.gitService.config,
            'build',
            status.repositoryUri,
            status.buildEnv,
          );
        },
      },
      (existing) => existing,
    ).manage(options);

    status.imageTag = imageTag;
    status.imageName = imageName;
    status.imageSize = imageSize;
  }

  async push(
    status: DockerDeployStatus & EcrDeployStatus,
    consumer: RegistryAuthConsumer,
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev) {
      return;
    }

    let authConfig: Dockerode.AuthConfig | undefined = undefined;
    try {
      authConfig = await consumer.authConfig;
    } catch (e) {
      // No-op
    }

    const { imageDigest } = await new CloudResource<PushInfo, PushInfo>(
      {
        describe: (resource) => {
          return {
            type: 'Local Image Digest',
            label: resource.imageDigest || 'sha256:[computed]',
          };
        },
        read: () => {
          return this.dockerCiService.describePush(this.gitService.config);
        },
        update: (resource) => {
          return this.dockerCiService.push(
            this.gitService.config,
            status.repositoryUri,
            resource.imageName,
            authConfig,
          );
        },
      },
      (existing) => existing,
    ).manage(options);

    status.imageDigest = imageDigest;
  }
}
