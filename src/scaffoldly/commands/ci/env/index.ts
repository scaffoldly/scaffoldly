import { ResourceOptions } from '../../cd';
import { config as dotenv } from 'dotenv';
import { expand as dotenvExpand } from 'dotenv-expand';
import { join } from 'path';
import { GitDeployStatus, GitService } from '../../cd/git';
import { isDebug } from '@actions/core';
import { SecretConsumer, SecretDeployStatus } from '../../cd/aws/secret';
import { LambdaDeployStatus } from '../../cd/aws/lambda';
import { ui } from '../../../command';

export type EnvDeployStatus = {
  envFiles?: string[];
  buildEnv?: Record<string, string>;
  runtimeEnv?: Record<string, string>;
  producedEnv?: Record<string, string>;
  secrets?: string[];
};

const normalizeBranch = (branch: string) => branch.replaceAll('/', '-').replaceAll('_', '-');

const redact = (input: string): string => {
  const length = input.length;
  let slice = 2;

  if (length <= 2) {
    slice = 0; // Fully redacted for strings with length 2 or less
  } else if (length <= 4) {
    slice = 1; // Only the first and last character visible for strings with length 3 or 4
  }

  return `${input.slice(0, slice)}${'.'.repeat(length - slice * 2)}${input.slice(-slice)}`;
};

export interface EnvProducer {
  get env(): Promise<Record<string, string>>;
}

export class EnvService implements SecretConsumer {
  private _envFiles?: string[];

  private _secrets?: string[];

  private _processEnv: Record<string, string | undefined>;

  private _secretEnv: Record<string, string | undefined>;

  private envProducers: EnvProducer[] = [];

  constructor(private gitService: GitService, secrets: Record<string, string | undefined>) {
    this._processEnv = Object.entries(process.env).reduce((acc, [key, value]) => {
      if (!value) {
        return acc;
      }
      acc[key] = `${value}`;
      return acc;
    }, {} as Record<string, string | undefined>);

    this._secretEnv = Object.entries(secrets).reduce((acc, [key, value]) => {
      if (!value) {
        return acc;
      }
      acc[key] = `${value}`;
      return acc;
    }, {} as Record<string, string | undefined>);
  }

  addProducer(producer: EnvProducer): void {
    this.envProducers.push(producer);
  }

  get secretValue(): Promise<Uint8Array> {
    return this.computeEnv().then(({ combinedEnv }) => {
      const secretEnv = this._secrets?.reduce((acc, secret) => {
        const value = combinedEnv[secret];
        if (!value) {
          // TODO: message this better
          //throw new Error(`Secret \`${secret}\` not found in environment`);
          return acc;
        }
        ui.updateBottomBarSubtext(`Injecting secret \`${secret}\`: ${redact(value)}`);
        acc[secret] = value;
        return acc;
      }, {} as Record<string, string | undefined>);

      return Uint8Array.from(Buffer.from(JSON.stringify(secretEnv), 'utf-8'));
    });
  }

  public async predeploy(
    status: GitDeployStatus & EnvDeployStatus & SecretDeployStatus & LambdaDeployStatus,
  ): Promise<void> {
    const { secrets } = await this.computeEnv();
    this._secrets = secrets;
    status.secrets = this._secrets;

    this._envFiles = this.getEnvFiles(status);
    status.envFiles = this._envFiles;

    status.buildEnv = await this.getBuildEnv();
    status.runtimeEnv = await this.getRuntimeEnv();
    status.producedEnv = await this.producedEnv;
  }

  public async deploy(
    status: EnvDeployStatus & SecretDeployStatus & LambdaDeployStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: ResourceOptions,
  ): Promise<void> {
    status.buildEnv = await this.getBuildEnv();
    status.runtimeEnv = await this.getRuntimeEnv();
    status.producedEnv = await this.producedEnv;
  }

  private get producedEnv(): Promise<Record<string, string>> {
    return Promise.all(this.envProducers.map((producer) => producer.env)).then((envs) =>
      envs.reduce((acc, env) => ({ ...acc, ...env }), {}),
    );
  }

  private async computeEnv(): Promise<{
    env: Record<string, string>;
    secrets: string[];
    combinedEnv: Record<string, string>;
  }> {
    return Promise.all([this.gitService.workDir, this.producedEnv]).then(
      async ([cwd, producedEnv]) => {
        const processEnv = {};

        const { parsed: unexpanded = {} } = dotenv({
          path: this._envFiles?.map((f) => join(cwd, f)),
          debug: isDebug(),
          processEnv,
        });

        const combinedEnv = Object.entries({
          ...producedEnv,
          ...this._processEnv,
          ...this._secretEnv,
        }).reduce((acc, [key, value]) => {
          if (!value) {
            return acc;
          }
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);

        const { parsed: expanded = {} } = dotenvExpand({
          parsed: processEnv,
          processEnv: combinedEnv, // Don't mutuate processEnv
        });

        // Secrets are any values that are still unexpanded
        const secrets = Object.entries(unexpanded).reduce((acc, [key, value]) => {
          if (!value.includes('$') || expanded[key]) {
            return acc;
          }
          if (value.startsWith('${') && value.endsWith('}')) {
            // TODO handle ones with defaults
            acc.push(value.slice(2, -1));
          }
          acc.push(key);
          return acc;
        }, [] as string[]);

        return { env: expanded, secrets, combinedEnv };
      },
    );
  }

  private async getBuildEnv(): Promise<Record<string, string>> {
    return this.computeEnv().then(({ env }) =>
      Object.entries(env).reduce((acc, [key, value]) => {
        if (this._secrets?.includes(key)) {
          return acc;
        }
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>),
    );
  }

  private async getRuntimeEnv(): Promise<Record<string, string>> {
    return Promise.all([this.producedEnv]).then(([producedEnv]) => {
      return {
        SLY_ROUTES: JSON.stringify(this.gitService.config.routes), // TODO encode
        SLY_SERVE: this.gitService.config.serveCommands.encode(),
        SLY_DEBUG: 'true', // TODO use flag
        ...producedEnv,
      };
    });
  }

  private getEnvFiles(status: GitDeployStatus): string[] {
    const base = '.env';

    const files: string[] = [];

    const { branch, defaultBranch } = status || {};

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
