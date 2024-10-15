import { RunCommand } from '..';
import { ScaffoldlyConfig } from '../../../../../config';

export class PipPackageService {
  packages: string[];

  constructor(private config: ScaffoldlyConfig) {
    const packages = (config.packages || [])
      .filter((p) => p.startsWith('pip:'))
      .map((p) => {
        const dependency = p.split(':')[1];

        if (!dependency) {
          return [undefined];
        }

        if (p.startsWith('pip:')) {
          return [dependency];
        }

        return [undefined];
      })
      .flat()
      .filter((p) => !!p) as string[];

    this.packages = packages;
  }

  get dependencies(): Record<string, string> {
    const projectJson = this.config.projectJson;
    const dependencies = projectJson?.dependencies || {};
    const devDependencies = projectJson?.devDependencies || {};
    return { ...dependencies, ...devDependencies };
  }

  get paths(): Promise<string[]> {
    const paths: string[] = [];

    return Promise.resolve(paths);
  }

  get commands(): Promise<RunCommand[]> {
    if (this.packages.length === 0) {
      return Promise.resolve([]);
    }

    // TODO: support yarn and npm
    return Promise.resolve(this.npm);
  }

  get npm(): RunCommand[] {
    return [
      {
        prerequisite: true,
        cmds: [`pip install --no-cache-dir ${this.packages.join(' ')}`],
      },
    ];
  }
}
