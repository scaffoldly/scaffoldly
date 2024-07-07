import { join } from 'path';
import { ScaffoldlyConfig } from '../../config';
import { readFileSync } from 'fs';

export type PackageJsonBin = { [key: string]: string };

export type PackageJson = {
  name?: string;
  version?: string;
  bin?: PackageJsonBin;
  files?: string[];
  scaffoldly?: ScaffoldlyConfig;
};

export class Command {
  get cwd(): string {
    return process.cwd();
  }

  get packageJson(): PackageJson {
    const packageJson = JSON.parse(readFileSync(join(this.cwd, 'package.json'), 'utf8'));

    return packageJson;
  }

  get config(): ScaffoldlyConfig {
    const packageJson = this.packageJson;

    const { name, version, files = [], bin, scaffoldly: config } = packageJson;

    if (!config) {
      throw new Error('Missing `scaffoldly` in package.json');
    }

    if (!name) {
      throw new Error('Missing `name` in package.json');
    }

    if (!version) {
      throw new Error('Missing `version` in package.json');
    }

    if (!config.name) {
      config.name = name;
    }

    if (!config.version) {
      config.version = version;
    }

    config.bin = bin;
    config.files = this.prepareFiles(files, config);

    return config;
  }

  protected prepareFiles(files: string[], config: ScaffoldlyConfig): string[] {
    return [
      ...new Set(
        [...['README.md', 'LICENSE'], ...files, ...(config.files || [])].reduce((acc, file) => {
          if (file.startsWith('!')) {
            return acc;
          }

          acc.push(file);

          return acc;
        }, [] as string[]),
      ),
    ];
  }
}
