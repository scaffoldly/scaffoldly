import { BuildInfo, DockerService as DockerCiService, PushInfo } from '../../ci/docker';
import { CloudResource, ResourceOptions } from '..';
import { ScaffoldlyConfig } from '../../../../config';
import { DeployStatus } from '../aws';
import { RegistryAuthConsumer } from '../aws/ecr';

export type Architecture = 'arm64' | 'amd64';

export type DockerDeployStatus = {
  imageTag?: string;
  imageName?: string;
  imageDigest?: string;
};

export class DockerService {
  config: ScaffoldlyConfig;

  constructor(config: ScaffoldlyConfig, private dockerCiService: DockerCiService) {
    this.config = config;
  }

  get architecture(): Promise<Architecture> {
    return this.dockerCiService.getArchitecture(this.config.runtime);
  }

  public async deploy(
    status: DeployStatus,
    consumer: RegistryAuthConsumer,
    options: ResourceOptions,
  ): Promise<DeployStatus> {
    const dockerStatus: DockerDeployStatus = {};

    const { imageName, imageTag } = await new CloudResource<BuildInfo, BuildInfo>(
      {
        describe: (resource) => {
          return { type: 'Image', label: resource.imageName };
        },
        read: () => this.dockerCiService.describeBuild(),
        update: () =>
          this.dockerCiService.build(this.config, 'build', status.repositoryUri, status.buildEnv),
      },
      (existing) => existing,
    ).manage(options);

    dockerStatus.imageTag = imageTag;
    dockerStatus.imageName = imageName;

    if (!imageName) {
      throw new Error('Missing image name');
    }

    const authConfig = await consumer.authConfig;

    const { imageDigest } = await new CloudResource<PushInfo, PushInfo>(
      {
        describe: (resource) => {
          return { type: 'Image Digest', label: resource.imageDigest };
        },
        read: () => this.dockerCiService.describePush(),
        update: (resource) => this.dockerCiService.push(resource.imageName, authConfig),
      },
      (existing) => existing,
    ).manage(options);

    dockerStatus.imageDigest = imageDigest;

    return { ...status, ...dockerStatus };
  }
}
