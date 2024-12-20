import { ProjectJson } from '..';
import { AbstractProject } from './abstract';
import { readFileSync, writeFileSync } from 'fs';

export class StandaloneProject extends AbstractProject {
  async setProject(name: string): Promise<void> {
    return this.standaloneConfigFile.then((standaloneConfigFile) => {
      if (!standaloneConfigFile) {
        return;
      }

      const standaloneConfig = JSON.parse(readFileSync(standaloneConfigFile, 'utf8'));

      standaloneConfig.name = name;

      // TODO: support yaml
      writeFileSync(standaloneConfigFile, JSON.stringify(standaloneConfig, null, 2));
    });
  }

  get projectJson(): Promise<ProjectJson | undefined> {
    return this.standaloneConfig.then((standaloneConfig) => {
      if (!standaloneConfig) {
        return undefined;
      }

      const projectJson: ProjectJson = { type: 'standalone' };
      projectJson.name = standaloneConfig.name;
      projectJson.version = standaloneConfig.version;
      projectJson.scaffoldly = standaloneConfig;

      return projectJson;
    });
  }
}
