import { ProjectJson } from '..';
import { AbstractProject } from '.';

export class StandaloneProject extends AbstractProject {
  get projectJson(): Promise<ProjectJson | undefined> {
    return this.standaloneConfig.then((standaloneConfig) => {
      if (!standaloneConfig) {
        return undefined;
      }

      const projectJson: ProjectJson = {};
      projectJson.name = standaloneConfig.name;
      projectJson.version = standaloneConfig.version;
      projectJson.scaffoldly = standaloneConfig;

      return projectJson;
    });
  }
}
