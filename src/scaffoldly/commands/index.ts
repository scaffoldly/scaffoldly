import { join } from 'path';
import { Mode, PackageJson, ScaffoldlyConfig } from '../../config';
import { readFileSync } from 'fs';
import { Preset } from './deploy';
import { NextJsPreset } from '../../config/presets/nextjs';

export type Cwd = string;

export abstract class Command<T> {
  private _config?: ScaffoldlyConfig;

  private _mode?: Mode;

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
      const nextJsPreset = new NextJsPreset(this.cwd, this._mode);
      this._config = await nextJsPreset.config;
    }
    return this;
  }

  withMode(mode?: Mode): Command<T> {
    this._mode = mode;
    return this;
  }

  get mode(): Mode {
    if (!this._mode) {
      throw new Error('No Mode Found');
    }
    return this._mode;
  }

  get config(): ScaffoldlyConfig {
    console.log('!!! mode', this._mode);
    if (!this._config && this.packageJson) {
      try {
        this._config = new ScaffoldlyConfig({ packageJson: this.packageJson }, this._mode);
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
