import { base58 } from '@scure/base';
import pkg from '../../package.json';

export const decode = (config: string): ScaffoldlyConfig => {
  if (config.startsWith(`${pkg.name}@${pkg.version}:`)) {
    return JSON.parse(
      new TextDecoder().decode(base58.decode(config.split(`${pkg.name}@${pkg.version}:`)[1])),
    );
  }
  throw new Error(`Invalid config: ${config}`);
};

export type PackageJson = {
  name?: string;
  version?: string;
  bin?: PackageJsonBin;
  files?: string[];
  scaffoldly?: IScaffoldlyConfig;
};

export interface IScaffoldlyConfig extends IServiceConfig {
  get name(): string;
  get version(): string;
  get runtime(): string;
  get handler(): string;
  get files(): string[]; // Get copied to workdir/{file} during build and serve
  get devFiles(): string[]; // Get copied to workdir/{file} during dev
  get bin(): PackageJsonBin; // Get copied to workdir root
  get scripts(): { [key in Script]?: string };
  // get src(): string; // Defaults to "."
  get services(): IServiceConfig[];
  // http: bool // Defaults to true
  // routes // Required when services is defined
  // standalone: bool // Creates a completely separate container, defaults to true
}

export interface IServiceConfig {
  name?: string;
  runtime?: string;
  handler?: string;
  devFiles?: string[];
  srcRoot?: string;
}

export type PackageJsonBin = { [key: string]: string };

export type Script = 'develop' | 'build' | 'start';

export class ScaffoldlyConfig implements IScaffoldlyConfig {
  scaffoldly: Partial<IScaffoldlyConfig>;

  private _name?: string;

  private _version?: string;

  private _bin?: PackageJsonBin;

  private _files?: string[];

  constructor(configs: { packageJson?: PackageJson; encodedConfig?: string } = {}) {
    // TODO Support Devcontainer JSON
    const { packageJson, encodedConfig } = configs;

    if (encodedConfig) {
      const decodedConfig = decode(encodedConfig);
      this.scaffoldly = decodedConfig;
      this._name = decodedConfig.name;
      this._version = decodedConfig.version;
      this._bin = decodedConfig.bin;
      this._files = decodedConfig.files;
      return;
    }

    if (packageJson) {
      const { scaffoldly } = packageJson;
      if (!scaffoldly) {
        throw new Error('Missing `scaffoldly` in package.json');
      }
      this.scaffoldly = scaffoldly;
      this._name = packageJson.name;
      this._version = packageJson.version;
      this._bin = packageJson.bin;
      this._files = packageJson.files;
      return;
    }

    throw new Error('Unable to create scaffoldly config');
  }

  get name(): string {
    const { _name: name } = this;
    if (!name) {
      throw new Error('Missing `name`');
    }
    return name;
  }

  get version(): string {
    const { _version: version } = this;
    if (!version) {
      throw new Error('Missing `version`');
    }
    return version;
  }

  get runtime(): string {
    const { runtime } = this.scaffoldly;
    if (!runtime) {
      // TODO: Find runtime from one of the services
      throw new Error('Missing `runtime` in scaffoldly config');
    }
    return runtime;
  }

  get handler(): string {
    const { handler } = this.scaffoldly;
    if (!handler) {
      // TODO: Find runtime from one of the services
      throw new Error('Missing `handler` in scaffoldly config');
    }
    return handler;
  }

  get files(): string[] {
    const { _files: files = [] } = this;
    // TODO: add README and LICENSE, exclude entries that start with "!"
    // TODO: .scaffoldlyignore or gitignore parser, find out how yarn/npm does it
    return files;
  }

  get devFiles(): string[] {
    let { devFiles } = this.scaffoldly;
    if (!devFiles) {
      // TODO: Find devFiles from one of the services
      // TODO: Combine all devFiles from all services?
      devFiles = ['.'];
    }
    return devFiles;
  }

  get bin(): PackageJsonBin {
    const { _bin: bin = {} } = this;
    return bin;
  }

  get scripts(): { [key in Script]?: string } {
    const { scripts } = this.scaffoldly;
    if (!scripts) {
      throw new Error('Missing `scripts` in scaffoldly config');
    }
    return scripts;
  }

  get services(): IServiceConfig[] {
    const { services = [] } = this.scaffoldly;
    return services;
  }

  encode = (): string => {
    return `${pkg.name}@${pkg.version}:${base58.encode(
      new TextEncoder().encode(
        JSON.stringify({
          ...this.scaffoldly,
          name: this.name,
          version: this.version,
          bin: this.bin,
          files: this.files,
        }),
      ),
    )}`;
  };
}
