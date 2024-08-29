import { join } from 'path';
import { Mode, PackageJson, ScaffoldlyConfig } from '../../config';
import { readFileSync } from 'fs';
import { Preset } from './deploy';
import { NextJsPreset } from '../../config/presets/nextjs';

export type Cwd = string;

export abstract class Command<T> {
  private _config?: ScaffoldlyConfig;

  constructor(public readonly cwd: string, private _mode: Mode) {}

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
    if (mode && mode !== this._mode) {
      console.warn(`🟠 Running in ${mode} mode`);
    }
    this._mode = mode || this._mode;
    return this;
  }

  get mode(): Mode {
    if (!this._mode) {
      throw new Error('No Mode Found');
    }
    return this._mode;
  }

  get config(): ScaffoldlyConfig {
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
