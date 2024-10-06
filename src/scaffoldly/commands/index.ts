import { Mode, ProjectJson, ScaffoldlyConfig } from '../../config';
import { NextJsPreset } from '../../config/presets/nextjs';
import { PermissionAware } from './cd';
import { PolicyDocument } from './cd/aws/iam';
import { Preset } from '../../config/presets';
import { PresetType } from './deploy';
import { GitService } from './cd/git';
import { NodeProject } from '../../config/projects/node';
import { DotnetProject } from '../../config/projects/dotnet';
import { GolangProject } from '../../config/projects/golang';

export type Cwd = string;

export abstract class Command<T> implements PermissionAware {
  private _config?: ScaffoldlyConfig;

  private _preset?: Preset;

  private _permissions: string[] = [];

  constructor(protected gitService: GitService, private _mode: Mode) {}

  abstract handle(subcommand?: string): Promise<void>;

  get projectJson(): Promise<ProjectJson | undefined> {
    return Promise.all([
      new NodeProject(this.gitService).projectJson,
      new DotnetProject(this.gitService).projectJson,
      new GolangProject(this.gitService).projectJson,
    ]).then(([node, dotnet, golang]) => {
      return node || dotnet || golang;
    });
  }

  async withPreset(preset?: PresetType): Promise<Command<T>> {
    if (preset === 'nextjs') {
      this._preset = new NextJsPreset(this.gitService, this._mode);
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

  get config(): Promise<ScaffoldlyConfig> {
    if (this._config) {
      return Promise.resolve(this._config);
    }

    return Promise.all([this.gitService.baseDir, this.gitService.workDir, this.projectJson]).then(
      ([baseDir, workDir, projectJson]) => {
        // TODO: Other config places
        if (projectJson) {
          try {
            this._config = new ScaffoldlyConfig(
              baseDir,
              workDir,
              { projectJson: projectJson },
              this._mode,
            );
            return this._config;
          } catch (e) {
            throw new Error('Unable to locate scaffoldly configuration', {
              cause: e,
            });
          }
        }

        throw new Error('No Scaffoldly Config Found');
      },
    );
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
