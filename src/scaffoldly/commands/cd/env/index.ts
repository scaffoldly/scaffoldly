import { DeployStatus } from '../aws';
import { ResourceOptions } from '..';
import { ScaffoldlyConfig } from '../../../../config';
import { config as dotenv } from 'dotenv';
import { expand as dotenvExpand } from 'dotenv-expand';
import { join } from 'path';
import { isDebug } from '../../../ui';

export type EnvDeployStatus = {
  envFiles?: string[];
  buildEnv?: Record<string, string>;
};

const normalizeBranch = (branch: string | undefined) => branch?.replace('/', '-');

export class EnvService {
  private lastStatus: DeployStatus = {};

  constructor(private cwd: string, private config: ScaffoldlyConfig) {}

  public async predeploy(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    status: DeployStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: ResourceOptions,
  ): Promise<DeployStatus> {
    this.lastStatus = status;

    const envDeployStatus: EnvDeployStatus = {
      envFiles: this.envFiles,
      buildEnv: this.buildEnv,
    };

    return { ...status, ...envDeployStatus };
  }

  public async deploy(
    status: DeployStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: ResourceOptions,
  ): Promise<DeployStatus> {
    this.lastStatus = status;

    const envDeployStatus: EnvDeployStatus = {
      buildEnv: this.buildEnv,
    };

    return { ...status, ...envDeployStatus };
  }

  private get baseEnv(): Record<string, string> {
    // This is separate b/c we don't want these in the generated Dockerfiles
    return {
      SLY_ROUTES: JSON.stringify(this.config.routes), // TODO encode
      SLY_SERVE: this.config.serveCommands.encode(),
      SLY_SECRET: this.lastStatus.secretName || '',
      SLY_ORIGIN: this.lastStatus.origin || '',
    };
  }

  get buildEnv(): Record<string, string> {
    console.log('!!! baseEnv', this.baseEnv);

    const processEnv = Object.entries(process.env).reduce(
      (acc, [k, v]) => {
        if (!v) return acc;
        acc[k] = v;
        return acc;
      },
      // Allow the base env to be interpolated into the build env
      // Although some of the values may be unknown at build time
      this.baseEnv,
    );

    const { parsed = {} } = dotenv({
      path: this.envFiles.map((f) => join(this.cwd, f)),
      debug: isDebug(),
      processEnv: { ...processEnv }, // Don't mutuate processEnv
    });

    const { parsed: expanded = {} } = dotenvExpand({
      parsed: parsed,
      processEnv: { ...processEnv }, // Don't mutuate processEnv
    });

    return expanded;
  }

  get runtimeEnv(): Record<string, string> {
    return {
      ...this.baseEnv,
      ...this.buildEnv,
    };
  }

  get envFiles(): string[] {
    const base = '.env';

    const files = [
      normalizeBranch(this.lastStatus.branch),
      normalizeBranch(this.lastStatus.defaultBranch),
    ].filter((f) => !!f) as string[];

    const envFiles = new Set(files.map((f) => `${base}.${f}`));

    // TODO PR files?
    // TODO Branch env files?
    // TODO Tags env files?

    return [...envFiles, base];
  }
}
