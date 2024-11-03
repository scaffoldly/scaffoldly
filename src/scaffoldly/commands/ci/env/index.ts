import { DeployStatus } from '../../cd/aws';
import { ResourceOptions } from '../../cd';
import { config as dotenv } from 'dotenv';
import { expand as dotenvExpand } from 'dotenv-expand';
import { join } from 'path';
import { GitService } from '../../cd/git';
import { isDebug } from '@actions/core';
import { SecretConsumer, SecretDeployStatus } from '../../cd/aws/secret';
import { LambdaDeployStatus } from '../../cd/aws/lambda';
import { ui } from '../../../command';

export type EnvDeployStatus = {
  envFiles?: string[];
  buildEnv?: Record<string, string>;
  producedEnv?: Record<string, string>;
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
  private lastStatus?: DeployStatus;

  private _env: Record<string, string | undefined>;

  private _secretEnv: Record<string, string | undefined>;

  private envProducers: EnvProducer[] = [];

  constructor(private gitService: GitService, secrets: Record<string, string | undefined>) {
    this._env = Object.entries(process.env).reduce((acc, [key, value]) => {
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
    return this.computeEnv().then(({ secrets, combinedEnv }) => {
      const secretEnv = secrets.reduce((acc, secret) => {
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
    status: EnvDeployStatus & SecretDeployStatus & LambdaDeployStatus,
  ): Promise<void> {
    this.lastStatus = status;

    status.envFiles = this.envFiles;
    status.buildEnv = await this.buildEnv;
    status.producedEnv = await this.producedEnv;

    this.lastStatus = status;
  }

  public async deploy(
    status: EnvDeployStatus & SecretDeployStatus & LambdaDeployStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: ResourceOptions,
  ): Promise<void> {
    this.lastStatus = status;

    status.buildEnv = await this.buildEnv;
    status.producedEnv = await this.producedEnv;

    this.lastStatus = status;
  }

  private get baseEnv(): Record<string, string> {
    // This is separate b/c we don't want these in the generated Dockerfiles
    return {
      URL: this.lastStatus?.url || '',
    };
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
        const processEnv = this.baseEnv;

        const { parsed: unexpanded = {} } = dotenv({
          path: this.envFiles.map((f) => join(cwd, f)),
          debug: isDebug(),
          processEnv,
        });

        const combinedEnv = Object.entries({
          ...producedEnv,
          ...this.baseEnv,
          ...this._env,
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

  get secrets(): Promise<string[]> {
    return this.computeEnv().then(({ secrets }) => secrets);
  }

  get buildEnv(): Promise<Record<string, string>> {
    return this.computeEnv().then(({ env, secrets }) =>
      Object.entries(env).reduce((acc, [key, value]) => {
        if (secrets.includes(key)) {
          return acc;
        }
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>),
    );
  }

  get runtimeEnv(): Promise<Record<string, string>> {
    return Promise.all([this.producedEnv, this.buildEnv]).then(([producedEnv, buildEnv]) => {
      return {
        SLY_ROUTES: JSON.stringify(this.gitService.config.routes), // TODO encode
        SLY_SERVE: this.gitService.config.serveCommands.encode(),
        SLY_SECRET: this.lastStatus?.secretName || '',
        SLY_DEBUG: 'true', // TODO use flag
        ...producedEnv,
        ...this.baseEnv,
        ...buildEnv,
      };
    });
  }

  get dockerEnv(): string[] {
    return Object.entries(this.runtimeEnv).map(([k, v]) => `${k}=${v}`);
  }

  get envFiles(): string[] {
    const base = '.env';

    const files: string[] = [];

    const { branch, defaultBranch } = this.lastStatus || {};

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
