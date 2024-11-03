import { ResourceOptions } from '../../cd';
import { config as dotenv } from 'dotenv';
import { expand as dotenvExpand } from 'dotenv-expand';
import { join } from 'path';
import { GitDeployStatus, GitService } from '../../cd/git';
import { SecretDeployStatus } from '../../cd/aws/secret';
import { LambdaDeployStatus } from '../../cd/aws/lambda';

export type EnvDeployStatus = {
  envFiles?: string[];
};

const normalizeBranch = (branch: string) => branch.replaceAll('/', '-').replaceAll('_', '-');

// const redact = (input: string): string => {
//   const length = input.length;
//   let slice = 2;

//   if (length <= 2) {
//     slice = 0; // Fully redacted for strings with length 2 or less
//   } else if (length <= 4) {
//     slice = 1; // Only the first and last character visible for strings with length 3 or 4
//   }

//   return `${input.slice(0, slice)}${'.'.repeat(length - slice * 2)}${input.slice(-slice)}`;
// };

export interface EnvProducer {
  get env(): Promise<Record<string, string>>;
}

export class EnvService {
  private _envFiles?: string[];

  private _processEnv: Record<string, string>;

  private _secretEnv: Record<string, string>;

  private envProducers: EnvProducer[] = [];

  constructor(private gitService: GitService, secrets: Record<string, string | undefined>) {
    this._processEnv = Object.entries(process.env).reduce((acc, [key, value]) => {
      if (!value) {
        return acc;
      }
      acc[key] = `${value}`;
      return acc;
    }, {} as Record<string, string>);

    this._secretEnv = Object.entries(secrets).reduce((acc, [key, value]) => {
      if (!value) {
        return acc;
      }
      acc[key] = `${value}`;
      return acc;
    }, {} as Record<string, string>);
  }

  addProducer(producer: EnvProducer): void {
    this.envProducers.push(producer);
  }

  public async predeploy(
    status: GitDeployStatus & EnvDeployStatus & SecretDeployStatus & LambdaDeployStatus,
  ): Promise<void> {
    const branch = await this.gitService.branch;
    const defaultBranch = await this.gitService.defaultBranch;
    this._envFiles = this.getEnvFiles(branch, defaultBranch);
    status.envFiles = this._envFiles;
  }

  public async deploy(
    status: EnvDeployStatus & SecretDeployStatus & LambdaDeployStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: ResourceOptions,
  ): Promise<void> {
    const branch = await this.gitService.branch;
    const defaultBranch = await this.gitService.defaultBranch;
    this._envFiles = this.getEnvFiles(branch, defaultBranch);
    status.envFiles = this._envFiles;
  }

  private get producedEnv(): Promise<Record<string, string>> {
    return Promise.all(this.envProducers.map((producer) => producer.env)).then((envs) =>
      envs.reduce((acc, env) => ({ ...acc, ...env }), {}),
    );
  }

  get buildEnv(): Promise<Record<string, string>> {
    return Promise.all([this.gitService.workDir, this.producedEnv, this.secrets]).then(
      async ([cwd, producedEnv]) => {
        const buildEnv = { ...producedEnv };
        dotenvExpand(
          dotenv({ path: this._envFiles?.map((f) => join(cwd, f)), processEnv: buildEnv }),
        );

        // TODO: Filter secrets from build env?
        return buildEnv;
      },
    );
  }

  get runtimeEnv(): Promise<Record<string, string>> {
    return Promise.all([this.buildEnv, this.secrets]).then(async ([buildEnv, secrets]) => {
      const runtimeEnv = {
        SLY_ROUTES: JSON.stringify(this.gitService.config.routes), // TODO encode
        SLY_SERVE: this.gitService.config.serveCommands.encode(),
        SLY_DEBUG: 'true', // TODO use flag
        ...buildEnv,
      };

      // Filter out secrets from runtime env
      const filtered = Object.entries(runtimeEnv).reduce((acc, [key, value]) => {
        if (!secrets.includes(key)) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>);

      return filtered;
    });
  }

  get secrets(): Promise<string[]> {
    return Promise.all([this.gitService.workDir]).then(async ([cwd]) => {
      const parsed =
        dotenv({
          path: this._envFiles?.map((f) => join(cwd, f)),
          processEnv: { ...this._processEnv },
        }).parsed || {};

      const expanded =
        dotenvExpand({
          parsed: { ...parsed },
          processEnv: { ...this._processEnv },
        }).parsed || {};

      // Secrets are any values that are still unexpanded
      const secrets = Object.entries(parsed).reduce((acc, [key, value]) => {
        if (expanded[key] === '' && parsed[key] === value) {
          acc.push(key);
        }
        if (value.startsWith('${') && value.endsWith('}')) {
          acc.push(value.slice(2, -1));
        }
        return acc;
      }, [] as string[]);

      return secrets;
    });
  }

  get secretEnv(): Promise<Record<string, string>> {
    return Promise.all([this.gitService.workDir, this.secrets]).then(async ([cwd, secrets]) => {
      const secretEnv = secrets.reduce((acc, key) => {
        // TODO: Warn if secret is unkown
        const value = this._secretEnv[key] || '';
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      dotenvExpand(
        dotenv({ path: this._envFiles?.map((f) => join(cwd, f)), processEnv: secretEnv }),
      );

      return secretEnv;
    });
  }

  private getEnvFiles(branch?: string, defaultBranch?: string): string[] {
    const base = '.env';

    const files: string[] = [];

    if (branch === 'tagged') {
      files.push(this.gitService.tag);
      files.push('tagged');
    }

    if (branch) {
      files.push(normalizeBranch(branch));
    }

    if (defaultBranch) {
      files.push(normalizeBranch(defaultBranch));
    }

    const envFiles = new Set(files.map((f) => `${base}.${f}`));

    // TODO PR files?
    // TODO Branch env files?
    // TODO Tags env files?

    return [...envFiles, base];
  }
}
