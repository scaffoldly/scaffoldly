import { join } from 'path';
import { PackageJson, ScaffoldlyConfig } from '../../config';
import { readFileSync } from 'fs';
import { Preset } from './cd/deploy';
import { NextJsPreset } from '../../config/presets/nextjs';
import { DocusaurusPreset } from '../../config/presets/docusaurus';

export type Cwd = string;

export abstract class Command<T> {
  private _config?: ScaffoldlyConfig;

  constructor(public readonly cwd: string) {}

  abstract handle(): Promise<void>;

  get packageJson(): PackageJson | undefined {
    try {
      const packageJson = JSON.parse(readFileSync(join(this.cwd, 'package.json'), 'utf8'));

      return packageJson;
    } catch (e) {
      return undefined;
    }
  }

  async withPreset(preset?: Preset): Promise<Command<T>> {
    if (preset === 'nextjs') {
      const nextJsPreset = new NextJsPreset(this.cwd);
      this._config = await nextJsPreset.config;
    }
    if (preset === 'docusaurus') {
      const docusaurusPreset = new DocusaurusPreset(this.cwd);
      this._config = await docusaurusPreset.config;
    }
    return this;
  }

  get config(): ScaffoldlyConfig {
    if (!this._config && this.packageJson) {
      try {
        this._config = new ScaffoldlyConfig({ packageJson: this.packageJson });
      } catch (e) {
        throw new Error('Unable to create a Scaffoldly Config.', {
          cause: e,
        });
      }
    }
    if (!this._config) {
      throw new Error('No Scaffoldly Config Found');
    }
    return this._config;
  }
}
