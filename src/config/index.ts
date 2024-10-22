import { base58 } from '@scure/base';
import { join, relative, sep } from 'path';
import ignore from 'ignore';
import { existsSync, readdirSync, readFileSync } from 'fs';

export const DEFAULT_SRC_ROOT = `.`;
export const DEFAULT_ROUTE = '/*';

// DEVNOTE: Coupled with with the "scaffoldly/scaffoldly:1" docker image
// We use this for:
// - Version Consistency
// - Scooping compiled binaries out of the container (such as awslambda-entrypoint)
export const CONFIG_SIGNATURE = `scaffoldly/scaffoldly:1`;
export const DEFAULT_TASKDIR = join(sep, 'var', 'task');

export const decode = <T>(config: string): T => {
  if (config.startsWith(`${CONFIG_SIGNATURE}:`)) {
    return JSON.parse(
      new TextDecoder().decode(base58.decode(config.split(`${CONFIG_SIGNATURE}:`)[1])),
    );
  }
  throw new Error(`Invalid config: ${config}`);
};

export const encode = <T>(config: T): string => {
  return `${CONFIG_SIGNATURE}:${base58.encode(new TextEncoder().encode(JSON.stringify(config)))}`;
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

export type ProjectJson = {
  name?: string;
  version?: string;
  description?: string;
  license?: string;
  scripts?: { [key: string]: string };
  bin?: ProjectJsonBin;
  files?: string[];
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  scaffoldly?: Partial<IScaffoldlyConfig>;
};

export type Routes = { [key: string]: string | undefined };
export type Scripts = { [key in Script]?: string };
export type Schedules = { [key in Schedule]?: string };

export interface IScaffoldlyConfig extends IServiceConfig {
  // Supported in top level and service level:
  get id(): string;
  get name(): string;
  get runtime(): string;
  get handler(): string;
  get bin(): ProjectJsonBin; // Get copied to workdir root
  get files(): string[]; // Get copied to workdir/{file} during build and serve
  get src(): string; // Defaults to "."
  get packages(): string[];
  get shell(): Shell | undefined;
  get scripts(): Scripts;
  get schedules(): Schedules;

  // Top level configuration only:
  get version(): string;
  get taskdir(): string; // Defaults to /var/task
  get services(): Partial<IServiceConfig>[];
  get routes(): Routes;
  get resources(): string[];
  get timeout(): number;
  get memorySize(): number;
  get generatedFiles(): string[];
  get user(): string | undefined;
}

export type ServiceName = string;

export interface IServiceConfig {
  id: string;
  name: ServiceName;
  runtime: string;
  handler: string;
  bin?: ProjectJsonBin;
  files?: string[];
  src: string;
  packages?: string[];
  shell?: Shell;
  scripts: { [key in Script]?: string };
  schedules: { [key in Schedule]?: string };
}

export type ProjectJsonBin = { [key: string]: string };

export type Script = 'prepare' | 'dev' | 'install' | 'build' | 'package' | 'start';

export type Mode = 'development' | 'debug' | 'production';

// DEVNOTE: Edit .github/release.yml if more '@-schedules` are added
export type Schedule = '@immediately' | '@frequently' | '@hourly' | '@daily';

export class ScaffoldlyConfig implements IScaffoldlyConfig {
  projectJson?: ProjectJson;

  scaffoldly: Partial<IScaffoldlyConfig>;

  serviceConfig?: IServiceConfig;

  private mode: Mode;

  private _id = '';

  private _name: string;

  private _version: string;

  private _bin: ProjectJsonBin;

  private _files: string[];

  private _packages: string[];

  private _ignoreFilter?: (pathname: string) => boolean;

  constructor(
    public readonly baseDir: string,
    private workDir: string,
    configs: {
      projectJson?: ProjectJson;
      serviceConfig?: IServiceConfig;
    } = {},
    mode: Mode = 'production',
  ) {
    this.mode = mode;

    // TODO Support Devcontainer JSON and scaffoldly.json
    const { projectJson: projectJson, serviceConfig } = configs;
    this.projectJson = projectJson;

    if (projectJson) {
      const { scaffoldly = {}, name = 'unknown', version = '0.0.0-0' } = projectJson;
      this.scaffoldly = scaffoldly;
      this._name = name;
      this._version = version;
      this._bin = { ...(projectJson.bin || {}), ...(scaffoldly.bin || {}) };
      this._files = [...(projectJson.files || []), ...(scaffoldly.files || [])];
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
    let name = this.serviceConfig?.name || this._name || 'unknown-service';

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
    const { runtime = 'alpine:3' } = this.serviceConfig || this.scaffoldly;
    return runtime;
  }

  get handler(): string {
    const { handler = 'localhost:3000' } = this.serviceConfig || this.scaffoldly;
    return handler;
  }

  get files(): string[] {
    const { _files: files = [] } = this;
    return [...new Set(files)];
  }

  get src(): string {
    const { src = DEFAULT_SRC_ROOT } = this.serviceConfig || this.scaffoldly;
    return src;
  }

  get bin(): ProjectJsonBin {
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
      return new ScaffoldlyConfig(
        this.baseDir,
        this.workDir,
        {
          projectJson: this.projectJson,
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
        },
        this.mode,
      );
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

  get installCommands(): Commands {
    const script: Script = 'install';

    const cmds = new Commands();
    let workdir = this.src !== DEFAULT_SRC_ROOT ? this.src : undefined;

    if (this.scripts[script]) {
      cmds.add({
        cmd: this.scripts[script],
        workdir,
      });
    }

    this.services.forEach((service) => {
      workdir = service.src !== DEFAULT_SRC_ROOT ? service.src : undefined;

      if (service.scripts[script]) {
        cmds.add({
          cmd: service.scripts[script],
          workdir,
        });
      }
    });

    return cmds;
  }

  get serveCommands(): Commands {
    const script: Script = this.mode === 'development' ? 'dev' : 'start';

    const cmds = new Commands();
    let workdir = this.src !== DEFAULT_SRC_ROOT ? this.src : undefined;

    if (this.scripts[script]) {
      cmds.add({
        cmd: this.scripts[script],
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

      if (service.scripts[script]) {
        cmds.add({
          cmd: service.scripts[script],
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

  get rootdir(): string {
    let { taskdir } = this.scaffoldly;
    if (!taskdir) {
      taskdir = DEFAULT_TASKDIR;
    }
    return taskdir;
  }

  get taskdir(): string {
    const { rootdir } = this;
    const taskdir = join(rootdir, relative(this.baseDir, join(this.workDir)));
    return taskdir;
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

  get runtimes(): string[] {
    const runtimes = [
      CONFIG_SIGNATURE, // Always pull the scaffoldly container
      this.runtime,
      ...this.services.map((service) => service.runtime),
    ];
    return [...new Set(runtimes)];
  }

  get timeout(): number {
    const { timeout = 900 } = this.scaffoldly;
    return timeout;
  }

  get memorySize(): number {
    const { memorySize = 1024 } = this.scaffoldly;
    return memorySize;
  }

  get ignoreFilter(): (pathname: string) => boolean {
    if (this._ignoreFilter) {
      return this._ignoreFilter;
    }

    const ig = ignore();
    ['.gitignore', '.dockerignore'].map((filename) => {
      // Search for .gitignore/.dockerignore in the baseDir and workDir and workDir+src
      [
        join(this.baseDir, filename),
        join(this.workDir, filename),
        join(this.workDir, this.src, filename),
      ].forEach((file) => {
        if (existsSync(file)) {
          ig.add(readFileSync(file).toString());
        }
      });
    });

    this._ignoreFilter = ig.createFilter();
    return this._ignoreFilter;
  }

  get ignoredFiles(): string[] {
    const src = join(this.workDir, this.src);
    const files = readdirSync(src).filter((path) => {
      const relativePath = relative(this.workDir, path);
      return !this.ignoreFilter(relativePath);
    });
    return files;
  }

  get generatedFiles(): string[] {
    const { generatedFiles = [] } = this.scaffoldly;
    return generatedFiles;
  }

  get user(): string | undefined {
    const { user } = this.scaffoldly;
    return user;
  }
}
