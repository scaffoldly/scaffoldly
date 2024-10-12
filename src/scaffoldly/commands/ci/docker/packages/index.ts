import { CONFIG_SIGNATURE, ScaffoldlyConfig } from '../../../../../config';
import { Copy, DockerService, RunCommand } from '..';
import { NpmPackageService } from './npm';
import { OsPackageService } from './os';
import { join, relative } from 'path';
import { isLocalDeps } from '../../../../ui';

export class PackageService {
  osPackages: OsPackageService;

  npmPackages: NpmPackageService;

  constructor(private dockerService: DockerService, private config: ScaffoldlyConfig) {
    this.osPackages = new OsPackageService(this.dockerService, config);
    this.npmPackages = new NpmPackageService(config);
  }

  get entrypoint(): Copy {
    if (isLocalDeps()) {
      return {
        src: join(relative(this.config.baseDir, __dirname), 'awslambda-entrypoint.js'),
        dest: `.entrypoint`,
        resolve: true,
        mode: 0o755,
        entrypoint: true,
      };
    }

    // Copy awslambda-entrypoint from the scaffoldly image
    return {
      from: CONFIG_SIGNATURE, // Created in CI/CD
      src: `/${this.dockerService.platform}/awslambda-entrypoint`, // Set in in scripts/Dockerfile
      dest: `.entrypoint`,
      noGlob: true,
      absolute: true,
      entrypoint: true,
    };
  }

  get paths(): Promise<string[]> {
    const { taskdir, src } = this.config;
    return Promise.all([this.osPackages.paths, this.npmPackages.paths]).then((paths) => [
      join(taskdir, src),
      ...paths.flat(),
    ]);
  }

  get commands(): Promise<RunCommand[]> {
    return Promise.all([this.osPackages.commands, this.npmPackages.commands])
      .then((cmds) => cmds.flat())
      .catch((e) => {
        if (!(e instanceof Error)) {
          throw e;
        }
        throw new Error(`Error generating install commands for packages: ${e.message}`);
      });
  }
}
