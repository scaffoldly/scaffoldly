import { ResourceOptions } from '../../cd';
import { config as dotenv } from 'dotenv';
import { expand as dotenvExpand } from 'dotenv-expand';
import { join } from 'path';
import { GitDeployStatus, GitService } from '../../cd/git';
import { SecretDeployStatus } from '../../cd/aws/secret';
import { LambdaDeployStatus } from '../../cd/aws/lambda';
import { ui } from '../../../command';
import { isDebug } from '@actions/core';
import { encode } from '../../../../config';

export type EnvDeployStatus = {
  envFiles?: string[];
};

const normalizeBranch = (branch: string) => branch.replaceAll('/', '-').replaceAll('_', '-');

export const redact = (input?: string, slice = 2, short = false): string => {
  if (!input || input.length === 0) {
    return '[EMPTY]';
  }
  const length = input.length;

  if (length === 0) {
    return '[EMPTY]';
  }

  if (length <= 2) {
    slice = 0; // Fully redacted for strings with length 2 or less
  } else if (length <= 4) {
    slice = 1; // Only the first and last character visible for strings with length 3 or 4
  }

  if (short) {
    return `${input.slice(0, slice)}...${input.slice(-slice)}`;
  }

  return `${input.slice(0, slice)}${'.'.repeat(length - slice * 2)}${input.slice(-slice)}`;
};

export function shellEscape(value: string): string {
  // Escape backslashes, quotes, and special characters
  return value
    .replace(/\\/g, '\\\\') // Escape backslashes
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/'/g, "\\'") // Escape single quotes
    .replace(/\$/g, '\\$'); // Escape dollar signs (used in shell expansions)
}

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
    return Promise.all(
      this.envProducers.map((producer) => {
        return producer.env;
      }),
    ).then((envs) => envs.reduce((acc, env) => ({ ...acc, ...env }), {}));
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
        SLY_ROUTES: encode(this.gitService.config.routes),
        SLY_SERVE: this.gitService.config.serveCommands.encode(),
        SLY_DEBUG: 'true', // TODO use flag
        ...buildEnv,
      };

      // Filter out secrets from runtime env, and sanitize values
      const sanitized = Object.entries(runtimeEnv).reduce((acc, [key, value]) => {
        if (!secrets.includes(key)) {
          acc[key] = shellEscape(value);
        }
        return acc;
      }, {} as Record<string, string>);

      return sanitized;
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
        if (isDebug()) {
          console.warn(`\nChecking ${key} for expansion`);
          console.warn(`  Original Value: ${redact(value)}`);
          console.warn(`  Expanded Value: ${redact(expanded[key])}`);
          console.warn(`  Secret Value: ${redact(this._secretEnv[key])}`);
        }
        if (value === expanded[key] && !value.includes('$')) {
          // Raw value, do not include
          return acc;
        }
        if (expanded[key] === '' && parsed[key] === value) {
          // TODO Maybe throw an error
          ui.updateBottomBarSubtext(`⚠️  WARNING: Environment variable '${key}' is not set.`);
          acc.push(key);
        }
        if (value === expanded[key] && !this._secretEnv[key]) {
          // Variable was not substituted
          // console.warn();
          ui.updateBottomBarSubtext(
            `⚠️  WARNING: Environment variable '${key}' was not substituted.`,
          );
          acc.push(key);
        }
        if (value.startsWith('${') && value.endsWith('}')) {
          // TODO: Handle default values from dotenv expand
          const ref = value.slice(2, -1);
          if (this._secretEnv[ref]) {
            acc.push(ref);
            acc.push(key);
            if (ref === key) {
              ui.updateBottomBarSubtext(`Storing ${key} in secrets`);
            } else {
              ui.updateBottomBarSubtext(`Storing ${ref} and ${key} in secrets`);
            }
          }
        }
        return acc;
      }, [] as string[]);

      return secrets;
    });
  }

  get secretEnv(): Promise<Record<string, string>> {
    return Promise.all([this.gitService.workDir, this.secrets]).then(async ([cwd, secrets]) => {
      // Get env files with secrets and env
      const parsed =
        dotenv({
          path: this._envFiles?.map((f) => join(cwd, f)),
          processEnv: { ...this._secretEnv, ...this._processEnv },
        }).parsed || {};

      // Perform variable expansion
      const expanded =
        dotenvExpand({
          parsed: { ...parsed },
          processEnv: { ...this._secretEnv, ...this._processEnv },
        }).parsed || {};

      // Filter out non-secrets
      const filtered = Object.entries(expanded).reduce((acc, [key, value]) => {
        if (secrets.includes(key) && expanded[key]) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>);

      // Add secrets back that were not expanded
      const enriched = secrets.reduce((acc, key) => {
        if (!acc[key]) {
          acc[key] = this._secretEnv[key] || parsed[key] || `$\{${key}}`;
        }
        return acc;
      }, filtered);

      return enriched;
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
