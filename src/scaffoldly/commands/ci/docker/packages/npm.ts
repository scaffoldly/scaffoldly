import { join } from 'path';
import { RunCommand } from '..';
import { ScaffoldlyConfig } from '../../../../../config';

export class NpmPackageService {
  packages: string[];

  _hasScaffoldly = false;

  constructor(private config: ScaffoldlyConfig) {
    const packages = (config.packages || [])
      .filter((p) => p.startsWith('npm:') || p.startsWith('package.json:'))
      .map((p) => {
        const dependency = p.split(':')[1];

        if (!dependency) {
          return [undefined];
        }

        if (p.startsWith('npm:')) {
          return [dependency];
        }

        if (p.startsWith('package.json:')) {
          const version = this.dependencies[dependency];
          if (version) {
            return [`${dependency}@${version}`];
          }
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

  get hasScaffoldly(): boolean {
    return this._hasScaffoldly;
  }

  get paths(): Promise<string[]> {
    const paths: string[] = [];

    if (
      this.packages.length ||
      this.config.files.includes('node_modules') ||
      this.config.files.includes('package.json')
    ) {
      paths.push(join(this.config.taskdir, this.config.src, 'node_modules', '.bin'));
    }

    this._hasScaffoldly = !!this.dependencies.scaffoldly;

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
        cmds: [
          `npm install -g ${this.packages.join(' ')} --omit=dev --omit=optional --omit=peer`,
          `npm cache clean --force`,
        ],
      },
    ];
  }
}
