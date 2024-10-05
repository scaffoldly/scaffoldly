import { readFileSync } from 'fs';
import { ProjectJson } from '..';
import { join } from 'path';
import { AbstractProject } from '.';

export type PackageJson = ProjectJson;

export class NodeProject extends AbstractProject {
  private get packageJson(): Promise<ProjectJson | undefined> {
    return this.gitService.workDir.then((workDir) => {
      try {
        const packageJson = JSON.parse(readFileSync(join(workDir, 'package.json'), 'utf8'));
        return packageJson;
      } catch (e) {
        return undefined;
      }
    });
  }

  get projectJson(): Promise<ProjectJson | undefined> {
    return this.packageJson;
  }
}
