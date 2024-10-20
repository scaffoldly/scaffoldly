import { readFileSync } from 'fs';
import { Commands, IScaffoldlyConfig, ProjectJson, ScaffoldlyConfig } from '..';
import { GitService } from '../../scaffoldly/commands/cd/git';
import { join } from 'path';

export abstract class AbstractProject {
  constructor(private gitService?: GitService, private workDir?: string) {}

  get workdir(): Promise<string> {
    if (this.gitService) {
      return this.gitService.workDir;
    }
    if (this.workDir) {
      return Promise.resolve(this.workDir);
    }
    throw new Error('Workdir is unknown');
  }

  abstract setProject(name: string): Promise<void>;

  abstract get projectJson(): Promise<ProjectJson | undefined>;

  get standaloneConfigFile(): Promise<string | undefined> {
    return this.workdir.then((workDir) => {
      const standaloneConfigFile = join(workDir, 'scaffoldly.json');
      if (!readFileSync(standaloneConfigFile)) {
        return undefined;
      }
      return standaloneConfigFile;
    });
  }

  get standaloneConfig(): Promise<Partial<IScaffoldlyConfig> | undefined> {
    return this.standaloneConfigFile.then((standaloneConfigFile) => {
      if (!standaloneConfigFile) {
        return undefined;
      }

      const scaffoldlyConfig: Partial<IScaffoldlyConfig> = {};

      // TODO: Support YAML
      const parsed = JSON.parse(readFileSync(standaloneConfigFile, 'utf-8'));

      Object.assign(scaffoldlyConfig, parsed);

      return scaffoldlyConfig;
    });
  }

  get installCommands(): Promise<Commands | undefined> {
    return Promise.all([this.workDir, this.projectJson]).then(([workDir, projectJson]) => {
      if (!projectJson) {
        return;
      }

      if (!workDir) {
        return;
      }

      const config = new ScaffoldlyConfig(workDir, workDir, { projectJson });

      return config.installCommands;
    });
  }
}
