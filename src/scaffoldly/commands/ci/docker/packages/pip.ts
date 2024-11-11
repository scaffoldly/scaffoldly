import { Copy, RunCommand } from '..';
import { ScaffoldlyConfig } from '../../../../../config';

export class PipPackageService {
  packages: string[];

  requirementsFile?: string;

  constructor(private config: ScaffoldlyConfig) {
    const packages = (config.packages || [])
      .filter((p) => p.startsWith('pip:'))
      .map((p) => {
        const dependency = p.split(':')[1];

        if (!dependency) {
          return [undefined];
        }

        if (dependency === 'requirements.txt') {
          this.requirementsFile = dependency;
          return [undefined];
        }

        if (p.startsWith('pip:')) {
          return [dependency];
        }

        return [undefined];
      })
      .flat()
      .filter((p) => !!p) as string[];

    const implicitPackages = new Set(
      (config.packages || [])
        .map((p) => (p.startsWith('huggingface:') ? ['huggingface_hub[cli]'] : []))
        .flat(),
    );

    this.packages = [...packages, ...implicitPackages];
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
    if (this.packages.length === 0 && !this.requirementsFile) {
      return Promise.resolve([]);
    }

    // TODO: support yarn and npm
    return Promise.resolve(this.pip);
  }

  get files(): Promise<Copy[]> {
    return Promise.resolve([this.requirementsFile].filter((f) => !!f) as string[]).then((files) => {
      return files.map((file) => {
        return {
          prerequisite: true,
          src: file,
          dest: file,
        };
      });
    });
  }

  get pip(): RunCommand[] {
    const cmds: string[] = [];
    if (this.packages.length) {
      cmds.push(`pip install --no-cache-dir ${this.packages.join(' ')}`);
    }

    if (this.requirementsFile) {
      cmds.unshift(`pip install --no-cache-dir -r ${this.requirementsFile}`);
    }

    return [
      {
        prerequisite: true,
        cmds,
      },
    ];
  }
}
