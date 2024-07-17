import { base58 } from '@scure/base';
import pkg from '../../package.json';
import { join, sep } from 'path';

export const DEFAULT_SRC_ROOT = `.`;
export const DEFAULT_ROUTE = '/*';

export const decode = (config: string): ScaffoldlyConfig => {
  if (config.startsWith(`${pkg.name}@${pkg.version}:`)) {
    return JSON.parse(
      new TextDecoder().decode(base58.decode(config.split(`${pkg.name}@${pkg.version}:`)[1])),
    );
  }
  throw new Error(`Invalid config: ${config}`);
};

export class DockerCommands {
  commands: DockerCommand[];

  constructor() {
    this.commands = [];
  }

  add = (cmd: DockerCommand): DockerCommands => {
    this.commands.push(cmd);
    return this;
  };

  toString = (): string => {
    return this.commands.map((cmd) => cmd.toString()).join(' & ');
  };
}

export class DockerCommand {
  cmd: string;

  workdir?: string;

  constructor(cmd: string, workdir?: string) {
    this.cmd = cmd;
    this.workdir = workdir;
  }

  toString = (): string => {
    return this.workdir ? `( cd ${this.workdir} && ${this.cmd} )` : `( ${this.cmd} )`;
  };
}

export type PackageJson = {
  name?: string;
  version?: string;
  bin?: PackageJsonBin;
  files?: string[];
  scaffoldly?: IScaffoldlyConfig;
};

export type Routes = { [key: string]: string | undefined };

export interface IScaffoldlyConfig extends IServiceConfig {
  get name(): string;
  get version(): string;
  get runtime(): string;
  get handler(): string;
  get files(): string[]; // Get copied to workdir/{file} during build and serve
  get devFiles(): string[]; // Get copied to workdir/{file} during dev
  get bin(): PackageJsonBin; // Get copied to workdir root
  get scripts(): { [key in Script]?: string };
  get src(): string; // Defaults to "."
  get workdir(): string; // Defaults to /var/task
  get services(): Partial<IServiceConfig>[];
  get routes(): Routes;
  getService(identifier: string | number): IScaffoldlyConfig;
}

export interface IServiceConfig {
  name: string;
  runtime: string;
  handler: string;
  bin?: PackageJsonBin;
  files?: string[];
  devFiles?: string[];
  src: string;
  scripts: { [key in Script]?: string };
}

export type PackageJsonBin = { [key: string]: string };

export type Script = 'develop' | 'build' | 'start';

export class ScaffoldlyConfig implements IScaffoldlyConfig {
  packageJson?: PackageJson;

  scaffoldly: Partial<IScaffoldlyConfig>;

  serviceConfig?: IServiceConfig;

  private _name?: string;

  private _version?: string;

  private _bin?: PackageJsonBin;

  private _files?: string[];

  constructor(
    configs: {
      packageJson?: PackageJson;
      encodedConfig?: string;
      serviceConfig?: IServiceConfig;
    } = {},
  ) {
    // TODO Support Devcontainer JSON
    const { packageJson, encodedConfig, serviceConfig } = configs;
    this.packageJson = packageJson;

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

      if (serviceConfig) {
        // We're in a sub-service, don't pull in  nested services or routes
        this.scaffoldly = {
          ...this.scaffoldly,
          runtime: serviceConfig.runtime || this.runtime,
          services: [],
          routes: undefined,
        };
        this.serviceConfig = serviceConfig;
        this._name = `${packageJson.name}-${serviceConfig.name}`;
        this._files = [
          ...(packageJson.files || []),
          ...(serviceConfig.files || []).map((f) => join(serviceConfig.src, f)),
        ];
        this._bin = {
          ...(packageJson.bin || {}),
          ...Object.entries(serviceConfig.bin || {}).reduce((acc, [key, value]) => {
            acc[key] = join(serviceConfig.src, value);
            return acc;
          }, serviceConfig.bin || {}),
        };
      }

      return;
    }

    throw new Error('Unable to create scaffoldly config');
  }

  get name(): string {
    let { _name: name } = this;
    if (!name) {
      name = this.serviceConfig?.name;
    }
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
    let { runtime } = this.scaffoldly;
    if (!runtime) {
      runtime = this.serviceConfig?.runtime;
    }
    if (!runtime) {
      // TODO: Find runtime from one of the services
      throw new Error('Missing `runtime`');
    }
    return runtime;
  }

  get handler(): string {
    let { handler } = this.scaffoldly;
    if (!handler) {
      handler = this.serviceConfig?.handler;
    }
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

  // TODO: maybe get rid of this
  get devFiles(): string[] {
    let { devFiles } = this.scaffoldly;
    if (!devFiles) {
      devFiles = this.serviceConfig?.devFiles;
    }
    if (!devFiles) {
      // TODO: Find devFiles from one of the services
      // TODO: Combine all devFiles from all services?
      devFiles = [DEFAULT_SRC_ROOT];
    }
    return devFiles;
  }

  get src(): string {
    let { src } = this.scaffoldly;
    if (!src) {
      src = this.serviceConfig?.src;
    }
    if (!src) {
      src = DEFAULT_SRC_ROOT;
    }
    return src;
  }

  get bin(): PackageJsonBin {
    const { _bin: bin = {} } = this;
    return bin;
  }

  get scripts(): { [key in Script]?: string } {
    let { scripts } = this.scaffoldly;
    if (!scripts) {
      scripts = this.serviceConfig?.scripts;
    }
    if (!scripts) {
      scripts = {};
      // throw new Error('Missing `scripts` in scaffoldly config');
    }
    return scripts;
  }

  get services(): ScaffoldlyConfig[] {
    const { services = [] } = this.scaffoldly;
    return services.map((service, ix) => {
      return new ScaffoldlyConfig({
        packageJson: this.packageJson,
        serviceConfig: {
          name: service.name || `${ix + 1}`,
          runtime: service.runtime || this.runtime,
          handler: service.handler || this.handler,
          src: service.src || this.src,
          scripts: service.scripts || this.scripts,
          files: service.files || [],
          devFiles: service.devFiles,
          bin: service.bin || {},
        },
      });
    });
  }

  get routes(): Routes {
    let { routes } = this.scaffoldly;
    if (!routes) {
      routes = {};
    }
    if (!routes[DEFAULT_ROUTE]) {
      routes[DEFAULT_ROUTE] = this.handler;
    }
    return routes;
  }

  get cmd(): DockerCommands {
    const cmds = new DockerCommands();
    if (this.scripts.start) {
      cmds.add(
        new DockerCommand(this.scripts.start, this.src !== DEFAULT_SRC_ROOT ? this.src : undefined),
      );
    }

    this.services.forEach((service) => {
      if (service.scripts.start) {
        cmds.add(
          new DockerCommand(
            service.scripts.start,
            service.src !== DEFAULT_SRC_ROOT ? service.src : undefined,
          ),
        );
      }
    });

    return cmds;
  }

  get workdir(): string {
    let { workdir } = this.scaffoldly;
    if (!workdir) {
      workdir = join(sep, 'var', 'task');
    }
    return workdir;
  }

  getService(identifier: string | number): IScaffoldlyConfig {
    const service = this.services.find((s, ix) => s.name === identifier || ix === identifier);
    if (!service) {
      throw new Error(`Service ${identifier} not found`);
    }
    return service;
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
