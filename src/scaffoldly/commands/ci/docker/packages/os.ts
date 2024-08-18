import { ScaffoldlyConfig } from '../../../../../config';
import { DockerService, RunCommand } from '..';

export class OsPackageService {
  packages: string[];

  constructor(private dockerService: DockerService, private config: ScaffoldlyConfig) {
    this.packages = config.packages
      .filter((p) => p.indexOf(':') === -1 || p.startsWith('os:'))
      .map((p) => p.split(':').slice(-1)[0])
      .filter((p) => !!p);
  }

  get paths(): Promise<string[]> {
    const paths: string[] = [];
    return Promise.resolve(paths);
  }

  get commands(): Promise<RunCommand[]> {
    if (this.packages.length === 0) {
      return Promise.resolve([]);
    }

    return this.dockerService
      .getPlatform(this.config.runtimes, this.dockerService.architecture)
      .then((platform) =>
        this.dockerService
          .checkBin(this.config.runtime, ['yum', 'dnf', 'apk', 'apt'], platform)
          .catch((e) => {
            throw new Error(
              `Unable to determine package manager for ${this.config.runtime} on platform ${platform}`,
              { cause: e },
            );
          }),
      )
      .then((bin) => {
        switch (bin) {
          case 'apk':
            return this.apk;
          case 'apt':
            return this.apt;
          case 'dnf':
            return this.dnf;
          case 'yum':
            return this.yum;
          default:
            throw new Error(`Unknown package manager bin: ${bin}`);
        }
      })
      .catch((e) => {
        throw new Error(`Error generating install commands for OS packages: ${this.packages}`, {
          cause: e,
        });
      });
  }

  get apk(): RunCommand[] {
    return [
      {
        prerequisite: true,
        cmds: [
          `apk update`,
          `apk add --no-cache ${this.packages.join(' ')}`,
          `rm -rf /var/cache/apk/*`,
        ],
      },
    ];
  }

  get apt(): RunCommand[] {
    return [
      {
        prerequisite: true,
        cmds: [
          `apt update`,
          `apt install -y --no-install-recommends ${this.packages.join(' ')}`,
          `apt clean && rm -rf /var/lib/apt/lists/*`,
        ],
      },
    ];
  }

  get dnf(): RunCommand[] {
    return [
      {
        prerequisite: true,
        cmds: [
          `dnf install -y ${this.packages.join(' ')}`,
          `dnf clean all`,
          `rm -rf /var/cache/dnf`,
        ],
      },
    ];
  }

  get yum(): RunCommand[] {
    return [
      {
        prerequisite: true,
        cmds: [
          `yum install -y ${this.packages.join(' ')}`,
          `yum clean all`,
          `rm -rf /var/cache/yum`,
        ],
      },
    ];
  }
}
