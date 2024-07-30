import { DockerService as DockerCiService } from '../../ci/docker';
import { ResourceOptions } from '..';
import { ScaffoldlyConfig } from '../../../../config';
import { DeployStatus } from '../aws';
import { ui } from '../../../command';
import { RegistryAuthConsumer } from '../aws/ecr';

export type Architecture = 'arm64' | 'amd64';

export type DockerDeployStatus = {
  imageTag?: string;
  imageName?: string;
  imageDigest?: string;
  entrypoint?: string[];
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

    ui.updateBottomBar(`Building ${this.config.name}`);
    const { imageName, entrypoint, imageTag } = await this.dockerCiService.build(
      this.config,
      'build',
      status.repositoryUri,
      status.buildEnv,
    );
    dockerStatus.imageTag = imageTag;
    dockerStatus.imageName = imageName;
    dockerStatus.entrypoint = entrypoint;

    const authConfig = await consumer.authConfig;

    ui.updateBottomBar(`Pushing ${imageTag}`);
    // TODO: Move push to this class
    const { imageDigest } = await this.dockerCiService.push(imageName, authConfig);
    dockerStatus.imageDigest = imageDigest;

    if (options.clean) {
      throw new Error('Not implemented');
    }

    return { ...status, ...dockerStatus };
  }
}
