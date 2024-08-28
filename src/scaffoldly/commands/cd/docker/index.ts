import { BuildInfo, DockerService as DockerCiService, PushInfo } from '../../ci/docker';
import { CloudResource, ResourceOptions } from '..';
import { EcrDeployStatus, RegistryAuthConsumer } from '../aws/ecr';
import { LambdaDeployStatus } from '../aws/lambda';
import { EnvDeployStatus } from '../../ci/env';
import { GitService } from '../git';

export type Platform = 'linux/amd64' | 'linux/arm64';

export type DockerDeployStatus = {
  imageTag?: string;
  imageName?: string;
  imageDigest?: string;
  imageSize?: number;
};

export class DockerService {
  constructor(private gitService: GitService, private dockerCiService: DockerCiService) {}

  get platform(): Platform {
    return this.dockerCiService.platform;
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
          return { type: 'Image', label: resource.imageName };
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

    if (!imageName) {
      throw new Error('Missing image name');
    }
  }

  async push(
    status: DockerDeployStatus,
    consumer: RegistryAuthConsumer,
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev) {
      return;
    }

    const authConfig = await consumer.authConfig;

    const { imageDigest } = await new CloudResource<PushInfo, PushInfo>(
      {
        describe: (resource) => {
          return { type: 'Image Digest', label: resource.imageDigest };
        },
        read: () => {
          return this.dockerCiService.describePush();
        },
        update: (resource) => {
          return this.dockerCiService.push(resource.imageName, authConfig);
        },
      },
      (existing) => existing,
    ).manage(options);

    status.imageDigest = imageDigest;
  }
}
