import { DockerService as DockerCiService } from '../../ci/docker';
import { ResourceOptions } from '..';
import { ScaffoldlyConfig } from '../../../../config';
import { DeployStatus } from '../aws';
import { ui } from '../../../command';
import { RegistryAuthConsumer } from '../aws/ecr';

export type Architecture = 'arm64' | 'amd64';

export type DockerDeployStatus = {
  imageName?: string;
  imageDigest?: string;
  entrypoint?: string[];
};

export class DockerService {
  config: ScaffoldlyConfig;

  constructor(config: ScaffoldlyConfig, private dockerService: DockerCiService) {
    this.config = config;
  }

  get architecture(): Promise<Architecture> {
    return this.dockerService.getArchitecture(this.config.runtime);
  }

  public async deploy(
    status: DeployStatus,
    consumer: RegistryAuthConsumer,
    options: ResourceOptions,
  ): Promise<DockerDeployStatus> {
    const dockerStatus: DockerDeployStatus = {};

    ui.updateBottomBar(`Building ${status.repositoryUri}`);
    const { imageName, entrypoint } = await this.dockerService.build(
      this.config,
      'build',
      status.repositoryUri,
    );
    dockerStatus.imageName = imageName;
    dockerStatus.entrypoint = entrypoint;

    const authConfig = await consumer.authConfig;

    ui.updateBottomBar(`Pushing ${imageName}`);
    const { imageDigest } = await this.dockerService.push(imageName, authConfig);
    dockerStatus.imageDigest = imageDigest;

    if (options.clean) {
      throw new Error('Not implemented');
    }

    return dockerStatus;
  }
}
