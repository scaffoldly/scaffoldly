import { base58 } from '@scure/base';
import pkg from '../../package.json';
import { join, sep } from 'path';
export const DEFAULT_SRC_ROOT = `.`;
export const DEFAULT_ROUTE = '/*';

export const decode = <T>(config: string, strict: boolean): T => {
  if (!strict && config.startsWith('base58:')) {
    return JSON.parse(new TextDecoder().decode(base58.decode(config.split('base58:')[1])));
  }
  if (config.startsWith(`${pkg.name}@${pkg.version}:`)) {
    return JSON.parse(
      new TextDecoder().decode(base58.decode(config.split(`${pkg.name}@${pkg.version}:`)[1])),
    );
  }
  throw new Error(`Invalid config: ${config}`);
};

export const encode = <T>(config: T, strict: boolean): string => {
  if (!strict) {
    return `base58:${base58.encode(new TextEncoder().encode(JSON.stringify(config)))}`;
  }
  return `${pkg.name}@${pkg.version}:${base58.encode(
    new TextEncoder().encode(JSON.stringify(config)),
  )}`;
};

export type Shell = 'direnv';

export type ServeCommand = {
  cmd: string;
  workdir?: string;
};

export class ServeCommands {
  serveCommands: ServeCommand[];

  constructor() {
    this.serveCommands = [];
  }

  add = (serveCommand: ServeCommand): ServeCommands => {
    this.serveCommands.push(serveCommand);
    return this;
  };

  toString = (): string => {
    return this.serveCommands
      .map((serveCommand) => {
        return serveCommand.workdir
          ? `( cd ${serveCommand.workdir} && ${serveCommand.cmd} )`
          : `( ${serveCommand.cmd} )`;
      })
      .join(' & ');
  };

  encode = (strict = true): string => {
    return encode(this.serveCommands, strict);
  };

  static decode = (config: string, strict = true): ServeCommand[] => {
    return decode(config, strict);
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
  get id(): string;
  get name(): string;
  get version(): string;
  get runtime(): string;
  get handler(): string;
  get files(): string[]; // Get copied to workdir/{file} during build and serve
  get bin(): PackageJsonBin; // Get copied to workdir root
  get scripts(): { [key in Script]?: string };
  get src(): string; // Defaults to "."
  get workdir(): string; // Defaults to /var/task
  get services(): Partial<IServiceConfig>[];
  get routes(): Routes;
  get secrets(): string[];
  get packages(): string[];
  get shell(): Shell | undefined;
  getService(identifier: string | number): IScaffoldlyConfig;
}

export type ServiceName = string;

export interface IServiceConfig {
  id: string;
  name: ServiceName;
  runtime: string;
  handler: string;
  bin?: PackageJsonBin;
  files?: string[];
  src: string;
  scripts: { [key in Script]?: string };
  packages?: string[];
  shell?: Shell;
}

export type PackageJsonBin = { [key: string]: string };

export type Script = 'develop' | 'install' | 'build' | 'package' | 'start';

export interface SecretConsumer {
  get secretValue(): Uint8Array;
}

export class ScaffoldlyConfig implements IScaffoldlyConfig, SecretConsumer {
  packageJson?: PackageJson;

  scaffoldly: Partial<IScaffoldlyConfig>;

  serviceConfig?: IServiceConfig;

  private _name?: string;

  private _version?: string;

  private _bin?: PackageJsonBin;

  private _files?: string[];

  private _packages?: string[];

  private _id = '';

  constructor(
    private strict: boolean,
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
      const decodedConfig = decode<ScaffoldlyConfig>(encodedConfig, this.strict);
      this.scaffoldly = decodedConfig;
      this._id = decodedConfig.id;
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
        this._name = serviceConfig.name;
        this._files = [...(packageJson.files || []), ...(serviceConfig.files || [])];
        this._bin = {
          ...(packageJson.bin || {}),
          ...(serviceConfig.bin || {}),
        };
        this._packages = [...(this.scaffoldly.packages || []), ...(serviceConfig.packages || [])];
      }

      return;
    }

    throw new Error('Unable to create scaffoldly config');
  }

  set id(id: string) {
    this._id = id;
  }

  get id(): string {
    const { _id: id } = this;
    if (!id) {
      return ''; // For truthy checks
    }
    return id;
  }

  get name(): ServiceName {
    let name = this.serviceConfig?.name || this._name;
    if (!name) {
      throw new Error('Missing `name`');
    }

    const re = /[a-z0-9]+(?:[._-][a-z0-9]+)*/; // From ECR Regex

    const replaced = name.replace(/\//g, '-');
    const sanitized = replaced.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const matches = sanitized.match(re);

    if (!matches || !matches[0]) {
      throw new Error(`Invalid service name: '${name}' (sanitized: ${sanitized})`);
    }

    name = matches[0];

    const id = this.serviceConfig?.id || this._id;
    if (id) {
      name = `${name}-${id}`;
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
    const { runtime } = this.serviceConfig || this.scaffoldly;
    if (!runtime) {
      // TODO: Find runtime from one of the services
      throw new Error('Missing `runtime`');
    }
    return runtime;
  }

  get handler(): string {
    const { handler } = this.serviceConfig || this.scaffoldly;
    if (!handler) {
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

  get src(): string {
    const { src = DEFAULT_SRC_ROOT } = this.serviceConfig || this.scaffoldly;
    return src;
  }

  get bin(): PackageJsonBin {
    const { _bin: bin = {} } = this;
    return bin;
  }

  get scripts(): { [key in Script]?: string } {
    const { scripts = {} } = this.serviceConfig || this.scaffoldly;
    return scripts;
  }

  get services(): ScaffoldlyConfig[] {
    const { services = [] } = this.scaffoldly;
    return services.map((service, ix) => {
      return new ScaffoldlyConfig(this.strict, {
        packageJson: this.packageJson,
        serviceConfig: {
          id: service.id || '',
          name: service.name || `${ix + 1}`,
          runtime: service.runtime || this.runtime,
          handler: service.handler || this.handler,
          src: service.src || this.src,
          scripts: service.scripts || {},
          files: service.files || [],
          bin: service.bin || {},
          packages: service.packages || [],
          shell: service.shell,
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

  get serveCommands(): ServeCommands {
    const cmds = new ServeCommands();
    if (this.scripts.start) {
      cmds.add({
        cmd: this.scripts.start,
        workdir: this.src !== DEFAULT_SRC_ROOT ? this.src : undefined,
      });
    }

    this.services.forEach((service) => {
      if (service.scripts.start) {
        cmds.add({
          cmd: service.scripts.start,
          workdir: service.src !== DEFAULT_SRC_ROOT ? service.src : undefined,
        });
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

  get secrets(): string[] {
    const { secrets = [] } = this.scaffoldly;
    return secrets;
  }

  get secretValue(): Uint8Array {
    const env = this.secrets.reduce((acc, secret) => {
      const value = process.env[secret];
      if (!value) {
        console.warn(`WARN: Secret ${secret} not found in environment`);
        return acc;
      }
      acc[secret] = value;
      return acc;
    }, {} as Record<string, string>);

    return Buffer.from(JSON.stringify(env), 'utf-8');
  }

  get packages(): string[] {
    return this._packages || [];
  }

  get shell(): Shell | undefined {
    const { shell } = this.serviceConfig || this.scaffoldly;
    return shell;
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
          packages: this.packages,
        }),
      ),
    )}`;
  };
}
