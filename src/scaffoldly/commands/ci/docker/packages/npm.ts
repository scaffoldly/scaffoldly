import { join } from 'path';
import { RunCommand } from '..';
import { ScaffoldlyConfig } from '../../../../../config';

export class NpmPackageService {
  packages: string[];

  _hasNode = false;

  constructor(private config: ScaffoldlyConfig) {
    const packages = (config.packages || [])
      .filter((p) => p.startsWith('npm:'))
      .map((p) => {
        const dependency = p.split(':')[1];

        if (!dependency) {
          return [undefined];
        }

        if (p.startsWith('npm:')) {
          return [dependency];
        }

        return [undefined];
      })
      .flat()
      .filter((p) => !!p) as string[];

    this.packages = packages;
  }

  get hasNode(): boolean {
    return this._hasNode;
  }

  get paths(): Promise<string[]> {
    const paths: string[] = [];

    if (
      this.packages.length ||
      this.config.files.includes('node_modules') ||
      this.config.files.includes('package.json')
    ) {
      paths.push(join(this.config.workdir, this.config.src, 'node_modules', '.bin'));
    }

    if (paths.length > 0 && this.config.files.includes('node_modules')) {
      this._hasNode = true;
    }

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
