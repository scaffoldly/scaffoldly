import {
  Architecture,
  BuildInfo,
  DockerService as DockerCiService,
  PushInfo,
} from '../../ci/docker';
import { CloudResource, ResourceOptions } from '..';
import { ScaffoldlyConfig } from '../../../../config';
import { EcrDeployStatus, RegistryAuthConsumer } from '../aws/ecr';
import { LambdaDeployStatus } from '../aws/lambda';
import { EnvDeployStatus } from '../env';

export type Platform = 'linux/amd64' | 'linux/arm64';

export type DockerDeployStatus = {
  imageTag?: string;
  imageName?: string;
  imageDigest?: string;
  imageSize?: number;
};

export class DockerService {
  config: ScaffoldlyConfig;

  constructor(config: ScaffoldlyConfig, private dockerCiService: DockerCiService) {
    this.config = config;
  }

  public async getPlatform(architecture: Architecture): Promise<Platform> {
    return this.dockerCiService.getPlatform(this.config.runtimes, architecture);
  }

  public async deploy(
    status: DockerDeployStatus & EcrDeployStatus & EnvDeployStatus & LambdaDeployStatus,
    consumer: RegistryAuthConsumer,
    options: ResourceOptions,
  ): Promise<void> {
    const { architecture } = status;
    if (!architecture) {
      throw new Error('Missing architecture');
    }

    const { imageName, imageTag, imageSize } = await new CloudResource<BuildInfo, BuildInfo>(
      {
        describe: (resource) => {
          return { type: 'Image', label: resource.imageName };
        },
        read: () => {
          return this.dockerCiService.describeBuild();
        },
        update: () => {
          return this.dockerCiService.build(
            this.config,
            'build',
            architecture,
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
