import { join } from 'path';
import { PackageJson, ScaffoldlyConfig } from '../../config';
import { readFileSync } from 'fs';

export type Cwd = string;

export class Command {
  private _config: ScaffoldlyConfig;

  constructor() {
    const packageJson = this.packageJson;
    this._config = new ScaffoldlyConfig(true, { packageJson });
  }

  get cwd(): Cwd {
    return process.cwd();
  }

  get packageJson(): PackageJson {
    const packageJson = JSON.parse(readFileSync(join(this.cwd, 'package.json'), 'utf8'));

    return packageJson;
  }

  get config(): ScaffoldlyConfig {
    return this._config;
  }
}
