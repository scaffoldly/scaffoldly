import { ScaffoldlyConfig } from '../../../../../config';
import { DockerService, RunCommand } from '..';
import { NpmPackageService } from './npm';
import { OsPackageService } from './os';
import { join } from 'path';

export class PackageService {
  osPackages: OsPackageService;

  npmPackages: NpmPackageService;

  constructor(private dockerService: DockerService, private config: ScaffoldlyConfig) {
    this.osPackages = new OsPackageService(this.dockerService, config);
    this.npmPackages = new NpmPackageService(config);
  }

  get paths(): Promise<string[]> {
    const { workdir, src } = this.config;
    return Promise.all([this.osPackages.paths, this.npmPackages.paths]).then((paths) => [
      join(workdir, src),
      ...paths.flat(),
    ]);
  }

  get commands(): Promise<RunCommand[]> {
    return Promise.all([this.osPackages.commands, this.npmPackages.commands]).then((cmds) =>
      cmds.flat(),
    );
  }
}
