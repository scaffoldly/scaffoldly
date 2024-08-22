import { DeployStatus } from '../aws';
import { ResourceOptions } from '..';
import { config as dotenv } from 'dotenv';
import { expand as dotenvExpand } from 'dotenv-expand';
import { join } from 'path';
import { GitService } from '../git';
import { isDebug } from '@actions/core';

export type EnvDeployStatus = {
  envFiles?: string[];
  buildEnv?: Record<string, string>;
};

const normalizeBranch = (branch: string) => branch.replaceAll('/', '-').replaceAll('_', '-');

export class EnvService {
  private lastStatus?: DeployStatus;

  constructor(private gitService: GitService) {}

  public async predeploy(status: DeployStatus): Promise<void> {
    this.lastStatus = status;

    status.envFiles = this.envFiles;
    status.buildEnv = this.buildEnv;

    this.lastStatus = status;
  }

  public async deploy(
    status: DeployStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: ResourceOptions,
  ): Promise<void> {
    this.lastStatus = status;

    status.buildEnv = this.buildEnv;

    this.lastStatus = status;
  }

  private get baseEnv(): Record<string, string> {
    // This is separate b/c we don't want these in the generated Dockerfiles
    return {
      URL: this.lastStatus?.url || '',
    };
  }

  get buildEnv(): Record<string, string> {
    const processEnv = this.baseEnv;

    dotenv({
      path: this.envFiles.map((f) => join(this.gitService.cwd, f)),
      debug: isDebug(),
      processEnv,
    });

    const combinedEnv = Object.entries(process.env).reduce(
      (acc, [k, v]) => {
        if (!v) return acc;
        acc[k] = v;
        return acc;
      },
      // Allow the base env to be interpolated into the build env
      // Although some of the values may be unknown at build time
      this.baseEnv,
    );

    const { parsed: expanded = {} } = dotenvExpand({
      parsed: processEnv,
      processEnv: combinedEnv, // Don't mutuate processEnv
    });

    return expanded;
  }

  get runtimeEnv(): Record<string, string> {
    return {
      SLY_ROUTES: JSON.stringify(this.gitService.config.routes), // TODO encode
      SLY_SERVE: this.gitService.config.serveCommands.encode(),
      SLY_SECRET: this.lastStatus?.secretName || '',
      ...this.baseEnv,
      ...this.buildEnv,
    };
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
