import { join } from 'path';
import { RunCommand } from '..';
import { ScaffoldlyConfig } from '../../../../../config';

export class NpmPackageService {
  packages: string[];

  constructor(private config: ScaffoldlyConfig) {
    this.packages = (config.packages || [])
      .filter((p) => p.startsWith('npm:'))
      .map((p) => p.split(':').slice(-1)[0])
      .filter((p) => !!p);
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
