import { readFileSync } from 'fs';
import { IScaffoldlyConfig, ProjectJson } from '..';
import { GitService } from '../../scaffoldly/commands/cd/git';
import { join } from 'path';

export abstract class AbstractProject {
  constructor(protected gitService: GitService) {}

  abstract get projectJson(): Promise<ProjectJson | undefined>;

  get standaloneConfig(): Promise<Partial<IScaffoldlyConfig> | undefined> {
    return this.gitService.workDir.then((workDir) => {
      try {
        const scaffoldlyConfig: Partial<IScaffoldlyConfig> = {};
        // TODO: Support YAML
        const parsed = JSON.parse(readFileSync(join(workDir, 'scaffoldly.json'), 'utf-8'));
        Object.assign(scaffoldlyConfig, parsed);

        return scaffoldlyConfig;
      } catch (e) {
        return undefined;
      }
    });
  }
}
