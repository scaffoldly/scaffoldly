import { RunCommand } from '..';
import { ScaffoldlyConfig } from '../../../../../config';

type PackageType = 'model' | 'dataset';

type Package = {
  name: string;
  type: PackageType;
  rev?: string;
};

const convertToPackage = (p: string, type: PackageType): Package => {
  const [name, rev] = p.split('@');
  return { name, rev, type };
};

const convertToCommand = (p: Package): string => {
  let cmd = p.type === 'dataset' ? `--repo-type dataset ${p.name}` : p.name;
  if (p.rev) {
    cmd = `${cmd} --revision ${p.rev}`;
  }
  return `huggingface-cli download ${cmd}`;
};

export class HuggingfacePackageService {
  packages: Package[];

  constructor(private config: ScaffoldlyConfig) {
    this.packages = (config.packages || [])
      .filter((p) => p.startsWith('huggingface:'))
      .map((p) => {
        const [manager, dependency, subdependency] = p.split(':');

        if (!manager && !dependency && !subdependency) {
          return [undefined];
        }

        if (manager === 'huggingface' && dependency === 'dataset' && subdependency) {
          return [convertToPackage(subdependency, 'dataset')];
        }

        if (manager === 'huggingface' && dependency && !subdependency) {
          return [convertToPackage(dependency, 'model')];
        }

        return [undefined];
      })
      .flat()
      .filter((p) => !!p) as Package[];
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
    return Promise.resolve(this.huggingface);
  }

  get huggingface(): RunCommand[] {
    const models = this.packages.filter((p) => p.type === 'model');
    const datasets = this.packages.filter((p) => p.type === 'dataset');
    const cmds = [...models.map(convertToCommand), ...datasets.map(convertToCommand)];
    return [
      {
        prerequisite: true,
        cmds,
      },
    ];
  }
}
