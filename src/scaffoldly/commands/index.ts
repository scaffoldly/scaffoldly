import { join } from 'path';
import { PackageJson, ScaffoldlyConfig } from '../../config';
import { readFileSync } from 'fs';

export class Command {
  private _config: ScaffoldlyConfig;

  constructor() {
    const packageJson = this.packageJson;
    this._config = new ScaffoldlyConfig({ packageJson });
  }

  get cwd(): string {
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
