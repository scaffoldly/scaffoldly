import { base58 } from '@scure/base';
import pkg from '../../package.json';
import { join, sep } from 'path';
export const DEFAULT_SRC_ROOT = `.`;
export const DEFAULT_ROUTE = '/*';

export const decode = <T>(config: string): T => {
  if (config.startsWith(`${pkg.name}@${pkg.version}:`)) {
    return JSON.parse(
      new TextDecoder().decode(base58.decode(config.split(`${pkg.name}@${pkg.version}:`)[1])),
    );
  }
  throw new Error(`Invalid config: ${config}`);
};

export const encode = <T>(config: T): string => {
  return `${pkg.name}@${pkg.version}:${base58.encode(
    new TextEncoder().encode(JSON.stringify(config)),
  )}`;
};

export type Shell = 'direnv';

export type Command = {
  cmd: string;
  workdir?: string;
  schedule?: Schedule;
  output?: string;
};

export class Commands {
  commands: Command[];

  constructor() {
    this.commands = [];
  }

  add = (command: Command): Commands => {
    this.commands.push(command);
    return this;
  };

  isEmpty = (filter?: { schedule?: Schedule }): boolean => {
    const filtered = filter
      ? this.commands.filter((command) => command.schedule === filter.schedule)
      : this.commands;

    return filtered.length === 0;
  };

  toString = (filter?: { schedule?: Schedule }): string => {
    const filtered = filter
      ? this.commands.filter((command) => command.schedule === filter.schedule)
      : this.commands;

    return filtered
      .map((command) => {
        return command.workdir
          ? `( cd ${command.workdir} && ${command.cmd} )`
          : `( ${command.cmd} )`;
      })
      .join(' & ');
  };

  encode = (): string => {
    return encode(this.commands);
  };

  static decode = (config: string): Commands => {
    const cmds: Command[] = decode<Command[]>(config);
    const commands = new Commands();
    cmds.forEach((cmd) => {
      commands.add(cmd);
    });
    return commands;
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
  // Supported in top level and service level:
  get id(): string;
  get name(): string;
  get runtime(): string;
  get handler(): string;
  get bin(): PackageJsonBin; // Get copied to workdir root
  get files(): string[]; // Get copied to workdir/{file} during build and serve
  get src(): string; // Defaults to "."
  get packages(): string[];
  get shell(): Shell | undefined;
  get scripts(): { [key in Script]?: string };
  get schedules(): { [key in Schedule]?: string };

  // Top level configuration only:
  get version(): string;
  get buildFiles(): string[]; // Get copied to workdir/{file} during build
  get workdir(): string; // Defaults to /var/task
  get services(): Partial<IServiceConfig>[];
  get routes(): Routes;
  get secrets(): string[];
  get resources(): string[];
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
  packages?: string[];
  shell?: Shell;
  scripts: { [key in Script]?: string };
  schedules: { [key in Schedule]?: string };
}

export type PackageJsonBin = { [key: string]: string };

export type Script = 'prepare' | 'develop' | 'install' | 'build' | 'package' | 'start';

// DEVNOTE: Edit .github/release.yml if more '@-schedules` are added
export type Schedule = '@immediately' | '@frequently' | '@hourly' | '@daily';

export interface SecretConsumer {
  get secretValue(): Uint8Array;
}

export class ScaffoldlyConfig implements IScaffoldlyConfig, SecretConsumer {
  packageJson?: PackageJson;

  scaffoldly: Partial<IScaffoldlyConfig>;

  serviceConfig?: IServiceConfig;

  private _id = '';

  private _name: string;

  private _version: string;

  private _bin: PackageJsonBin;

  private _files: string[];

  private _buildFiles: string[];

  private _packages: string[];

  constructor(
    configs: {
      packageJson?: PackageJson;
      serviceConfig?: IServiceConfig;
    } = {},
  ) {
    console.log('!!! process env', process.env);

    // TODO Support Devcontainer JSON and scaffoldly.json
    const { packageJson, serviceConfig } = configs;
    this.packageJson = packageJson;

    if (packageJson) {
      const { scaffoldly, name, version } = packageJson;
      if (!name) {
        throw new Error('Missing `name` in package.json');
      }
      if (!version) {
        throw new Error('Missing `version` in package.json');
      }
      if (!scaffoldly) {
        throw new Error('Missing `scaffoldly` in package.json');
      }
      this.scaffoldly = scaffoldly;
      this._name = name;
      this._version = version;
      this._bin = { ...(packageJson.bin || {}), ...(scaffoldly.bin || {}) };
      this._files = [...(packageJson.files || []), ...(scaffoldly.files || [])];
      this._buildFiles = scaffoldly.buildFiles || [];
      this._packages = scaffoldly.packages || [];

      if (serviceConfig) {
        // We're in a sub-service, don't pull in  nested services or routes
        this.scaffoldly = {
          ...scaffoldly,
          runtime: serviceConfig.runtime || scaffoldly.runtime,
          services: [],
          routes: undefined,
        };
        this.serviceConfig = serviceConfig;
        this._name = serviceConfig.name;
        this._packages = [...(serviceConfig.packages || [])];
        this._files = [...new Set([...(this._files || []), ...(serviceConfig.files || [])])];
        this._bin = {
          ...(this._bin || {}),
          ...(serviceConfig.bin || {}),
        };
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
    return [...new Set(files)];
  }

  get buildFiles(): string[] {
    const { _buildFiles: buildFiles = [] } = this;
    return [...new Set(buildFiles)];
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
      return new ScaffoldlyConfig({
        packageJson: this.packageJson,
        serviceConfig: {
          id: service.id || '',
          name: service.name || `${ix + 1}`,
          runtime: service.runtime || this.runtime,
          handler: service.handler || this.handler,
          src: service.src || this.src,
          files: service.files || [],
          bin: service.bin || {},
          packages: service.packages || [],
          shell: service.shell,
          scripts: service.scripts || {},
          schedules: service.schedules || {},
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

  get serveCommands(): Commands {
    const cmds = new Commands();
    let workdir = this.src !== DEFAULT_SRC_ROOT ? this.src : undefined;

    if (this.scripts.start) {
      cmds.add({
        cmd: this.scripts.start,
        workdir,
      });
    }

    Object.entries(this.schedules).forEach(([schedule, cmd]) => {
      cmds.add({
        cmd,
        workdir,
        schedule: schedule as Schedule,
      });
    });

    this.services.forEach((service) => {
      workdir = service.src !== DEFAULT_SRC_ROOT ? service.src : undefined;

      if (service.scripts.start) {
        cmds.add({
          cmd: service.scripts.start,
          workdir,
        });
      }

      Object.entries(service.schedules).forEach(([schedule, cmd]) => {
        cmds.add({
          cmd,
          workdir,
          schedule: schedule as Schedule,
        });
      });
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

  get schedules(): { [key in Schedule]?: string } {
    const { schedules = {} } = this.serviceConfig || this.scaffoldly;
    return schedules;
  }

  get resources(): string[] {
    const { resources = [] } = this.scaffoldly;
    return resources;
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
          buildFiles: this.buildFiles,
          packages: this.packages,
        }),
      ),
    )}`;
  };
}
