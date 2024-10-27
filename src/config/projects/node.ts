import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ProjectJson } from '..';
import { join } from 'path';
import { AbstractProject } from '.';

export type PackageJson = ProjectJson;

export class NodeProject extends AbstractProject {
  async setProject(name: string): Promise<void> {
    return this.packageJsonFile.then((packageJsonFile) => {
      if (!packageJsonFile) {
        return;
      }
      const packageJson = JSON.parse(readFileSync(packageJsonFile, 'utf8'));
      packageJson.name = name;
      delete packageJson.license;
      delete packageJson.description;
      writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2));
    });
  }

  private get packageJsonFile(): Promise<string | undefined> {
    return this.workdir
      .then((workDir) => join(workDir, 'package.json'))
      .then((packageJsonFile) => {
        if (!existsSync(packageJsonFile)) {
          return undefined;
        }
        return packageJsonFile;
      });
  }

  private get packageJson(): Promise<ProjectJson | undefined> {
    return this.packageJsonFile.then((packageJsonFile) => {
      if (!packageJsonFile) {
        return undefined;
      }
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonFile, 'utf8')) as ProjectJson;
        packageJson.type = 'node';
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
