import { BuildInfo, DockerService as DockerCiService, PushInfo } from '../../ci/docker';
import { CloudResource, ResourceOptions } from '..';
import { EcrDeployStatus, RegistryAuthConsumer } from '../aws/ecr';
import { LambdaDeployStatus } from '../aws/lambda';
import { EnvDeployStatus, EnvService } from '../../ci/env';
import { GitService } from '../git';
import Dockerode from 'dockerode';

export type Platform = 'linux/amd64' | 'linux/arm64';

export type DockerDeployStatus = {
  imageTag?: string;
  imageName?: string;
  imageDigest?: string;
  imageSize?: number;
  entrypoint?: string[];
  command?: string[];
};

export class DockerService {
  constructor(
    private gitService: GitService,
    public dockerCiService: DockerCiService,
    private envService: EnvService,
  ) {}

  get platform(): Platform {
    return this.dockerCiService.platform;
  }

  public async predeploy(
    status: EcrDeployStatus & DockerDeployStatus,
    consumer: RegistryAuthConsumer,
    options: ResourceOptions,
  ): Promise<void> {
    if (options.buildOnly) {
      return;
    }
    // Do an initial push to get a valid image digest
    await this.push(status, consumer, options);
  }

  public async deploy(
    status: DockerDeployStatus & EcrDeployStatus & EnvDeployStatus & LambdaDeployStatus,
    consumer: RegistryAuthConsumer,
    options: ResourceOptions,
  ): Promise<void> {
    await this.build(status, options);

    if (options.buildOnly) {
      return;
    }

    await this.push(status, consumer, options);
  }

  async build(
    status: DockerDeployStatus & EcrDeployStatus & EnvDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    const { imageName, imageTag, imageSize, entrypoint, command } = await new CloudResource<
      BuildInfo,
      BuildInfo
    >(
      {
        describe: (resource) => {
          return { type: 'Local Image', label: resource.imageName || '[computed]' };
        },
        read: () => {
          return this.dockerCiService.describeBuild(this.gitService.config);
        },
        update: () =>
          this.envService.buildEnv.then((buildEnv) =>
            this.dockerCiService.build(
              this.gitService.config,
              'build',
              status.repositoryUri,
              buildEnv,
            ),
          ),
      },
      (existing) => existing,
    ).manage(options);

    status.imageTag = imageTag;
    status.imageName = imageName;
    status.imageSize = imageSize;
    status.entrypoint = Array.isArray(entrypoint)
      ? entrypoint
      : entrypoint
      ? [entrypoint]
      : undefined;
    status.command = command;
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
