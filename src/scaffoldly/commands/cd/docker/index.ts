import { DockerService as DockerCiService } from '../../ci/docker';
import { ResourceOptions } from '..';
import { ScaffoldlyConfig } from '../../../../config';
import { DeployStatus } from '../aws';
import { ui } from '../../../command';
import { RegistryAuthConsumer } from '../aws/ecr';

export type DockerDeployStatus = {
  imageName?: string;
  imageDigest?: string;
  architecture?: string;
};

export class DockerService {
  config: ScaffoldlyConfig;

  constructor(config: ScaffoldlyConfig, private dockerService: DockerCiService) {
    this.config = config;
  }

  public async deploy(
    status: DeployStatus,
    consumer: RegistryAuthConsumer,
    options: ResourceOptions,
  ): Promise<DockerDeployStatus> {
    const dockerStatus: DockerDeployStatus = {};

    ui.updateBottomBar(`Building ${status.repositoryUri}`);
    const { imageName } = await this.dockerService.build(
      this.config,
      'build',
      status.repositoryUri,
    );
    dockerStatus.imageName = imageName;

    const authConfig = await consumer.authConfig;

    ui.updateBottomBar(`Pushing ${imageName}`);
    const { imageDigest, architecture } = await this.dockerService.push(imageName, authConfig);
    dockerStatus.imageDigest = imageDigest;
    dockerStatus.architecture = architecture;

    if (options.clean) {
      throw new Error('Not implemented');
    }

    return dockerStatus;
  }
}
