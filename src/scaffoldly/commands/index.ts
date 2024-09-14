import { join } from 'path';
import { Mode, PackageJson, ScaffoldlyConfig } from '../../config';
import { readFileSync } from 'fs';
import { NextJsPreset } from '../../config/presets/nextjs';
import { PermissionAware } from './cd';
import { PolicyDocument } from './cd/aws/iam';
import { Preset } from '../../config/presets';
import { PresetType } from './deploy';

export type Cwd = string;

export abstract class Command<T> implements PermissionAware {
  private _config?: ScaffoldlyConfig;

  private _preset?: Preset;

  private _permissions: string[] = [];

  constructor(public readonly cwd: string, private _mode: Mode) {}

  abstract handle(subcommand?: string): Promise<void>;

  get packageJson(): PackageJson | undefined {
    try {
      const packageJson = JSON.parse(readFileSync(join(this.cwd, 'package.json'), 'utf8'));

      return packageJson;
    } catch (e) {
      return undefined;
    }
  }

  async withPreset(preset?: PresetType): Promise<Command<T>> {
    if (preset === 'nextjs') {
      this._preset = new NextJsPreset(this.cwd, this._mode);
      this._config = await this._preset.config;
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

  get preset(): Preset | undefined {
    return this._preset;
  }

  get config(): ScaffoldlyConfig {
    if (!this._config && this.packageJson) {
      try {
        this._config = new ScaffoldlyConfig(
          this.cwd,
          { packageJson: this.packageJson },
          this._mode,
        );
      } catch (e) {
        throw new Error('Unable to locate scaffoldly configuration', {
          cause: e,
        });
      }
    }
    if (!this._config) {
      throw new Error('No Scaffoldly Config Found');
    }
    return this._config;
  }

  withPermissions(permissions: string[]): void {
    this._permissions = [...this._permissions, ...permissions];
  }

  get permissions(): string[] {
    return [...new Set(this._permissions)].sort();
  }

  get awsPolicyDocument(): PolicyDocument {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['iam:PassRole'],
          Resource: ['*'],
          Condition: {
            StringEquals: {
              'iam:PassedToService': ['lambda.amazonaws.com', 'scheduler.amazonaws.com'],
            },
          },
        },
        {
          Effect: 'Allow',
          Action: this.permissions,
          Resource: ['*'],
        },
      ],
    };
  }
}
