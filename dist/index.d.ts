declare module 'scaffoldly/awslambda-entrypoint/log' {
  export const isDebug: boolean;
  export const error: (message: unknown, obj?: Record<string, unknown>) => void;
  export const info: (message: unknown, obj?: Record<string, unknown>) => void;
  export const log: (message: unknown, obj?: Record<string, unknown>) => void;
  //# sourceMappingURL=log.d.ts.map
}
declare module 'scaffoldly/awslambda-entrypoint/log.d.ts' {
  {"version":3,"file":"log.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/awslambda-entrypoint/log.ts"],"names":[],"mappings":"AACA,eAAO,MAAM,OAAO,SAA0B,CAAC;AAG/C,eAAO,MAAM,KAAK,YAAa,OAAO,QAAQ,MAAM,CAAC,MAAM,EAAE,OAAO,CAAC,KAAG,IAOvE,CAAC;AAEF,eAAO,MAAM,IAAI,YAAa,OAAO,QAAQ,MAAM,CAAC,MAAM,EAAE,OAAO,CAAC,KAAG,IAOtE,CAAC;AAEF,eAAO,MAAM,GAAG,YAAa,OAAO,QAAQ,MAAM,CAAC,MAAM,EAAE,OAAO,CAAC,KAAG,IAQrE,CAAC"}
}
declare module 'scaffoldly/awslambda-entrypoint/mappers' {
  import { AbortEvent, AsyncResponse, RuntimeEvent } from 'scaffoldly/awslambda-entrypoint/types';
  import { OperatorFunction } from 'rxjs';
  import { Routes } from 'scaffoldly/config/index';
  export const mapRuntimeEvent: (abortEvent: AbortEvent, routes: Routes) => OperatorFunction<RuntimeEvent, AsyncResponse>;
  export const mapAsyncResponse: (abortEvent: AbortEvent, runtimeApi: string) => OperatorFunction<AsyncResponse, AsyncResponse>;
  //# sourceMappingURL=mappers.d.ts.map
}
declare module 'scaffoldly/awslambda-entrypoint/mappers.d.ts' {
  {"version":3,"file":"mappers.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/awslambda-entrypoint/mappers.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,UAAU,EAAE,aAAa,EAAE,YAAY,EAAE,MAAM,SAAS,CAAC;AAClE,OAAO,EAKL,gBAAgB,EAGjB,MAAM,MAAM,CAAC;AACd,OAAO,EAAE,MAAM,EAAE,MAAM,WAAW,CAAC;AAMnC,eAAO,MAAM,eAAe,eACd,UAAU,UACd,MAAM,KACb,gBAAgB,CAAC,YAAY,EAAE,aAAa,CAyB9C,CAAC;AAEF,eAAO,MAAM,gBAAgB,eACf,UAAU,cACV,MAAM,KACjB,gBAAgB,CAAC,aAAa,EAAE,aAAa,CAyE/C,CAAC"}
}
declare module 'scaffoldly/awslambda-entrypoint/observables' {
  import { Observable } from 'rxjs';
  import { Routes } from 'scaffoldly/config/index';
  import { AbortEvent, AsyncResponse, RuntimeEvent } from 'scaffoldly/awslambda-entrypoint/types';
  export const asyncResponse$: (abortEvent: AbortEvent, runtimeEvent: RuntimeEvent, routes: Routes) => Observable<AsyncResponse>;
  export const poll: (abortEvent: AbortEvent, runtimeApi: string, routes: Routes, env: Record<string, string>) => Promise<void>;
  //# sourceMappingURL=observables.d.ts.map
}
declare module 'scaffoldly/awslambda-entrypoint/observables.d.ts' {
  {"version":3,"file":"observables.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/awslambda-entrypoint/observables.ts"],"names":[],"mappings":"AAAA,OAAO,EAQL,UAAU,EAOX,MAAM,MAAM,CAAC;AACd,OAAO,EAA8B,MAAM,EAAE,MAAM,WAAW,CAAC;AAS/D,OAAO,EAAE,UAAU,EAAgB,aAAa,EAAE,YAAY,EAAE,MAAM,SAAS,CAAC;AAwLhF,eAAO,MAAM,cAAc,eACb,UAAU,gBACR,YAAY,UAClB,MAAM,KACb,UAAU,CAAC,aAAa,CA0E1B,CAAC;AAEF,eAAO,MAAM,IAAI,eACH,UAAU,cACV,MAAM,UACV,MAAM,OACT,MAAM,CAAC,MAAM,EAAE,MAAM,CAAC,KAC1B,OAAO,CAAC,IAAI,CAgBd,CAAC"}
}
declare module 'scaffoldly/awslambda-entrypoint/types' {
  import { ChildProcess } from 'child_process';
  import { AsyncSubject, Subject } from 'rxjs';
  import { Readable } from 'stream';
  export type SpawnResult = {
      childProcess?: ChildProcess;
      handler: string;
  };
  export type AsyncPrelude = {
      statusCode?: number;
      headers?: Record<string, unknown>;
      cookies?: string[];
  };
  export type AsyncResponse = {
      requestId?: string;
      prelude: AsyncPrelude;
      payload: Readable;
      response$: AsyncSubject<AsyncResponse>;
      completed$: Subject<AsyncResponse>;
      method?: string;
      url?: string;
      statusCode?: number;
      headers?: Record<string, unknown>;
  };
  export type RuntimeEvent = {
      requestId: string;
      event: string;
      deadline: number;
      env: Record<string, string>;
      response$: AsyncSubject<AsyncResponse>;
      completed$: Subject<AsyncResponse>;
  };
  export class AbortEvent extends AbortController {
      constructor();
      abort(reason: unknown): void;
  }
  //# sourceMappingURL=types.d.ts.map
}
declare module 'scaffoldly/awslambda-entrypoint/types.d.ts' {
  {"version":3,"file":"types.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/awslambda-entrypoint/types.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,YAAY,EAAE,MAAM,eAAe,CAAC;AAC7C,OAAO,EAAE,YAAY,EAAE,OAAO,EAAE,MAAM,MAAM,CAAC;AAE7C,OAAO,EAAE,QAAQ,EAAE,MAAM,QAAQ,CAAC;AAElC,MAAM,MAAM,WAAW,GAAG;IACxB,YAAY,CAAC,EAAE,YAAY,CAAC;IAC5B,OAAO,EAAE,MAAM,CAAC;CACjB,CAAC;AAEF,MAAM,MAAM,YAAY,GAAG;IACzB,UAAU,CAAC,EAAE,MAAM,CAAC;IACpB,OAAO,CAAC,EAAE,MAAM,CAAC,MAAM,EAAE,OAAO,CAAC,CAAC;IAClC,OAAO,CAAC,EAAE,MAAM,EAAE,CAAC;CACpB,CAAC;AAEF,MAAM,MAAM,aAAa,GAAG;IAC1B,SAAS,CAAC,EAAE,MAAM,CAAC;IACnB,OAAO,EAAE,YAAY,CAAC;IACtB,OAAO,EAAE,QAAQ,CAAC;IAClB,SAAS,EAAE,YAAY,CAAC,aAAa,CAAC,CAAC;IACvC,UAAU,EAAE,OAAO,CAAC,aAAa,CAAC,CAAC;IACnC,MAAM,CAAC,EAAE,MAAM,CAAC;IAChB,GAAG,CAAC,EAAE,MAAM,CAAC;IACb,UAAU,CAAC,EAAE,MAAM,CAAC;IACpB,OAAO,CAAC,EAAE,MAAM,CAAC,MAAM,EAAE,OAAO,CAAC,CAAC;CACnC,CAAC;AAEF,MAAM,MAAM,YAAY,GAAG;IACzB,SAAS,EAAE,MAAM,CAAC;IAClB,KAAK,EAAE,MAAM,CAAC;IACd,QAAQ,EAAE,MAAM,CAAC;IACjB,GAAG,EAAE,MAAM,CAAC,MAAM,EAAE,MAAM,CAAC,CAAC;IAC5B,SAAS,EAAE,YAAY,CAAC,aAAa,CAAC,CAAC;IACvC,UAAU,EAAE,OAAO,CAAC,aAAa,CAAC,CAAC;CACpC,CAAC;AAOF,qBAAa,UAAW,SAAQ,eAAe;;IAgB7C,KAAK,CAAC,MAAM,EAAE,OAAO,GAAG,IAAI;CAG7B"}
}
declare module 'scaffoldly/awslambda-entrypoint/util' {
  import { Routes } from 'scaffoldly/config/index';
  import { ALBEventQueryStringParameters } from 'aws-lambda';
  import { AxiosRequestConfig, AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios';
  import { Readable } from 'stream';
  import { AbortEvent, AsyncPrelude } from 'scaffoldly/awslambda-entrypoint/types';
  export const RESPONSE_STREAM_HEADERS: {
      'Transfer-Encoding': string;
      'Lambda-Runtime-Function-Response-Mode': string;
      'Content-Type': string;
      Trailer: string[];
  };
  export const intoResponseStream: (prelude: AsyncPrelude, payload: Readable) => Readable;
  export const fromResponseStream: (stream: Readable) => Promise<{
      prelude: AsyncPrelude;
      payload: Readable;
  }>;
  export const intoResponseStreamOptions: (abortEvent: AbortEvent, requestId?: string) => AxiosRequestConfig<Readable>;
  export const findHandler: (routes: Routes, rawPath?: string) => string | undefined;
  export function convertAlbQueryStringToURLSearchParams(params: ALBEventQueryStringParameters | undefined): URLSearchParams;
  export const transformAxiosResponseHeaders: (headers: RawAxiosResponseHeaders | AxiosResponseHeaders) => Record<string, unknown>;
  export const transformAxiosResponseCookies: (headers: RawAxiosResponseHeaders | AxiosResponseHeaders) => string[];
  //# sourceMappingURL=util.d.ts.map
}
declare module 'scaffoldly/awslambda-entrypoint/util.d.ts' {
  {"version":3,"file":"util.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/awslambda-entrypoint/util.ts"],"names":[],"mappings":"AAEA,OAAO,EAAE,MAAM,EAAE,MAAM,WAAW,CAAC;AACnC,OAAO,EAAE,6BAA6B,EAAE,MAAM,YAAY,CAAC;AAC3D,OAAO,EAEL,kBAAkB,EAElB,oBAAoB,EAEpB,uBAAuB,EACxB,MAAM,OAAO,CAAC;AACf,OAAO,EAAe,QAAQ,EAAE,MAAM,QAAQ,CAAC;AAC/C,OAAO,EAAE,UAAU,EAAE,YAAY,EAAE,MAAM,SAAS,CAAC;AAGnD,eAAO,MAAM,uBAAuB;;;;;CAKnC,CAAC;AAEF,eAAO,MAAM,kBAAkB,YAAa,YAAY,WAAW,QAAQ,KAAG,QAgB7E,CAAC;AAEF,eAAO,MAAM,kBAAkB,WACrB,QAAQ,KACf,OAAO,CAAC;IAAE,OAAO,EAAE,YAAY,CAAC;IAAC,OAAO,EAAE,QAAQ,CAAA;CAAE,CAgBtD,CAAC;AAEF,eAAO,MAAM,yBAAyB,eACxB,UAAU,cACV,MAAM,KACjB,kBAAkB,CAAC,QAAQ,CAU7B,CAAC;AAEF,eAAO,MAAM,WAAW,WAAY,MAAM,YAAY,MAAM,KAAG,MAAM,GAAG,SAsBvE,CAAC;AAEF,wBAAgB,sCAAsC,CACpD,MAAM,EAAE,6BAA6B,GAAG,SAAS,GAChD,eAAe,CAejB;AAED,eAAO,MAAM,6BAA6B,YAC/B,uBAAuB,GAAG,oBAAoB,KACtD,MAAM,CAAC,MAAM,EAAE,OAAO,CAOxB,CAAC;AAEF,eAAO,MAAM,6BAA6B,YAC/B,uBAAuB,GAAG,oBAAoB,KACtD,MAAM,EAGR,CAAC"}
}
declare module 'scaffoldly/awslambda-entrypoint' {
  #!/usr/bin/env node
  import { AbortEvent } from 'scaffoldly/awslambda-entrypoint/types';
  export const run: (abortEvent: AbortEvent) => Promise<void>;
  //# sourceMappingURL=awslambda-entrypoint.d.ts.map
}
declare module 'scaffoldly/awslambda-entrypoint.d.ts' {
  {"version":3,"file":"awslambda-entrypoint.d.ts","sourceRoot":"","sources":["../../../home/runner/work/scaffoldly/scaffoldly/src/awslambda-entrypoint.ts"],"names":[],"mappings":";AAGA,OAAO,EAAE,UAAU,EAAE,MAAM,8BAA8B,CAAC;AAO1D,eAAO,MAAM,GAAG,eAAsB,UAAU,KAAG,OAAO,CAAC,IAAI,CAkF9D,CAAC"}
}
declare module 'scaffoldly/config/index' {
  export const DEFAULT_SRC_ROOT = ".";
  export const DEFAULT_ROUTE = "/*";
  export const CONFIG_SIGNATURE = "scaffoldly/scaffoldly:1";
  export const DEFAULT_TASKDIR: string;
  export const decode: <T>(config: string) => T;
  export const encode: <T>(config: T) => string;
  export type Shell = 'direnv';
  export type Command = {
      cmd: string;
      workdir?: string;
      schedule?: Schedule;
      output?: string;
  };
  export class Commands {
      commands: Command[];
      constructor();
      add: (command: Command) => Commands;
      isEmpty: (filter?: {
          schedule?: Schedule;
      }) => boolean;
      toString: (filter?: {
          schedule?: Schedule;
      }) => string;
      encode: () => string;
      static decode: (config: string) => Commands;
  }
  export type ProjectJson = {
      name?: string;
      version?: string;
      description?: string;
      license?: string;
      scripts?: {
          [key: string]: string;
      };
      bin?: ProjectJsonBin;
      files?: string[];
      dependencies?: {
          [key: string]: string;
      };
      devDependencies?: {
          [key: string]: string;
      };
      scaffoldly?: Partial<IScaffoldlyConfig>;
  };
  export type Routes = {
      [key: string]: string | undefined;
  };
  export type Scripts = {
      [key in Script]?: string;
  };
  export type Schedules = {
      [key in Schedule]?: string;
  };
  export interface IScaffoldlyConfig extends IServiceConfig {
      get id(): string;
      get name(): string;
      get runtime(): string;
      get handler(): string;
      get bin(): ProjectJsonBin;
      get files(): string[];
      get src(): string;
      get packages(): string[];
      get shell(): Shell | undefined;
      get scripts(): Scripts;
      get schedules(): Schedules;
      get version(): string;
      get taskdir(): string;
      get services(): Partial<IServiceConfig>[];
      get routes(): Routes;
      get secrets(): string[];
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
      scripts: {
          [key in Script]?: string;
      };
      schedules: {
          [key in Schedule]?: string;
      };
  }
  export type ProjectJsonBin = {
      [key: string]: string;
  };
  export type Script = 'prepare' | 'dev' | 'install' | 'build' | 'package' | 'start';
  export type Mode = 'development' | 'debug' | 'production';
  export type Schedule = '@immediately' | '@frequently' | '@hourly' | '@daily';
  export interface SecretConsumer {
      get secretValue(): Uint8Array;
  }
  export class ScaffoldlyConfig implements IScaffoldlyConfig, SecretConsumer {
      readonly baseDir: string;
      private workDir;
      projectJson?: ProjectJson;
      scaffoldly: Partial<IScaffoldlyConfig>;
      serviceConfig?: IServiceConfig;
      private mode;
      private _id;
      private _name;
      private _version;
      private _bin;
      private _files;
      private _packages;
      private _ignoreFilter?;
      constructor(baseDir: string, workDir: string, configs?: {
          projectJson?: ProjectJson;
          serviceConfig?: IServiceConfig;
      }, mode?: Mode);
      set id(id: string);
      get id(): string;
      get name(): ServiceName;
      get version(): string;
      get runtime(): string;
      get handler(): string;
      get files(): string[];
      get src(): string;
      get bin(): ProjectJsonBin;
      get scripts(): {
          [key in Script]?: string;
      };
      get services(): ScaffoldlyConfig[];
      get routes(): Routes;
      get installCommands(): Commands;
      get serveCommands(): Commands;
      get rootdir(): string;
      get taskdir(): string;
      get secrets(): string[];
      get secretValue(): Uint8Array;
      get packages(): string[];
      get shell(): Shell | undefined;
      get schedules(): {
          [key in Schedule]?: string;
      };
      get resources(): string[];
      get runtimes(): string[];
      get timeout(): number;
      get memorySize(): number;
      get ignoreFilter(): (pathname: string) => boolean;
      get ignoredFiles(): string[];
      get generatedFiles(): string[];
      get user(): string | undefined;
  }
  //# sourceMappingURL=index.d.ts.map
}
declare module 'scaffoldly/config/index.d.ts' {
  {"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/config/index.ts"],"names":[],"mappings":"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"}
}
declare module 'scaffoldly/config/presets/index' {
  import { ScaffoldlyConfig } from 'scaffoldly/config/index';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  export abstract class Preset {
      protected gitService: GitService;
      constructor(gitService: GitService);
      abstract get config(): Promise<ScaffoldlyConfig>;
      abstract get configPath(): Promise<string>;
      save(): Promise<void>;
      private modifyJsonConfig;
  }
  //# sourceMappingURL=index.d.ts.map
}
declare module 'scaffoldly/config/presets/index.d.ts' {
  {"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/config/presets/index.ts"],"names":[],"mappings":"AACA,OAAO,EAAE,gBAAgB,EAAE,MAAM,IAAI,CAAC;AACtC,OAAO,EAAE,UAAU,EAAE,MAAM,kCAAkC,CAAC;AAE9D,8BAAsB,MAAM;IACd,SAAS,CAAC,UAAU,EAAE,UAAU;gBAAtB,UAAU,EAAE,UAAU;IAE5C,QAAQ,KAAK,MAAM,IAAI,OAAO,CAAC,gBAAgB,CAAC,CAAC;IACjD,QAAQ,KAAK,UAAU,IAAI,OAAO,CAAC,MAAM,CAAC,CAAC;IAErC,IAAI,IAAI,OAAO,CAAC,IAAI,CAAC;YAab,gBAAgB;CAkB/B"}
}
declare module 'scaffoldly/config/presets/nextjs' {
  import { Mode, ProjectJson, ProjectJsonBin, ScaffoldlyConfig } from 'scaffoldly/config/index';
  import { Preset } from 'scaffoldly/config/presets/index';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  export class NextJsPreset extends Preset {
      private mode?;
      constructor(gitService: GitService, mode?: Mode | undefined);
      get configPath(): Promise<string>;
      get config(): Promise<ScaffoldlyConfig>;
      get projectJson(): Promise<ProjectJson>;
      get runtime(): Promise<string>;
      get handler(): Promise<string>;
      get nextOutput(): Promise<'export' | 'standalone' | undefined>;
      get packages(): Promise<string[] | undefined>;
      get bin(): Promise<ProjectJsonBin | undefined>;
      get files(): Promise<string[]>;
      get lockfile(): Promise<string | undefined>;
      get public(): Promise<string | undefined>;
      get install(): Promise<string>;
      get start(): Promise<string | undefined>;
  }
  //# sourceMappingURL=nextjs.d.ts.map
}
declare module 'scaffoldly/config/presets/nextjs.d.ts' {
  {"version":3,"file":"nextjs.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/config/presets/nextjs.ts"],"names":[],"mappings":"AACA,OAAO,EAAE,IAAI,EAAE,WAAW,EAAE,cAAc,EAAE,gBAAgB,EAAE,MAAM,IAAI,CAAC;AAGzE,OAAO,EAAE,MAAM,EAAE,MAAM,GAAG,CAAC;AAC3B,OAAO,EAAE,UAAU,EAAE,MAAM,kCAAkC,CAAC;AAE9D,qBAAa,YAAa,SAAQ,MAAM;IACF,OAAO,CAAC,IAAI,CAAC;gBAArC,UAAU,EAAE,UAAU,EAAU,IAAI,CAAC,EAAE,IAAI,YAAA;IAIvD,IAAI,UAAU,IAAI,OAAO,CAAC,MAAM,CAAC,CAEhC;IAED,IAAI,MAAM,IAAI,OAAO,CAAC,gBAAgB,CAAC,CAkCtC;IAED,IAAI,WAAW,IAAI,OAAO,CAAC,WAAW,CAAC,CAStC;IAED,IAAI,OAAO,IAAI,OAAO,CAAC,MAAM,CAAC,CAE7B;IAED,IAAI,OAAO,IAAI,OAAO,CAAC,MAAM,CAAC,CAG7B;IAED,IAAI,UAAU,IAAI,OAAO,CAAC,QAAQ,GAAG,YAAY,GAAG,SAAS,CAAC,CAM7D;IAED,IAAI,QAAQ,IAAI,OAAO,CAAC,MAAM,EAAE,GAAG,SAAS,CAAC,CAO5C;IAED,IAAI,GAAG,IAAI,OAAO,CAAC,cAAc,GAAG,SAAS,CAAC,CAO7C;IAED,IAAI,KAAK,IAAI,OAAO,CAAC,MAAM,EAAE,CAAC,CAmB7B;IAED,IAAI,QAAQ,IAAI,OAAO,CAAC,MAAM,GAAG,SAAS,CAAC,CAa1C;IAED,IAAI,MAAM,IAAI,OAAO,CAAC,MAAM,GAAG,SAAS,CAAC,CAOxC;IAED,IAAI,OAAO,IAAI,OAAO,CAAC,MAAM,CAAC,CAU7B;IAED,IAAI,KAAK,IAAI,OAAO,CAAC,MAAM,GAAG,SAAS,CAAC,CAUvC;CACF"}
}
declare module 'scaffoldly/config/projects/dotnet' {
  import { ProjectJson } from 'scaffoldly/config/index';
  import { AbstractProject } from 'scaffoldly/config/projects/index';
  export type CsProj = {
      Project?: {
          PropertyGroup?: Array<{
              Version?: Array<string>;
              Scaffoldly?: Array<{
                  Runtime?: Array<string>;
                  Handler?: Array<string>;
                  Bin?: Array<{
                      $?: {
                          name?: string;
                      };
                      _: string;
                  }>;
                  Service?: Array<{
                      $?: {
                          name?: string;
                      };
                      File: Array<string>;
                      Script?: Array<{
                          $?: {
                              name?: string;
                          };
                          _: string;
                      }>;
                  }>;
              }>;
          }>;
          ItemGroup?: Array<{
              PackageReference?: {
                  $?: {
                      Include?: string;
                      Version?: string;
                  };
              }[];
          }>;
      };
  };
  export class DotnetProject extends AbstractProject {
      setProject(_name: string): Promise<void>;
      private get projectFile();
      private get project();
      get projectJson(): Promise<ProjectJson | undefined>;
  }
  //# sourceMappingURL=dotnet.d.ts.map
}
declare module 'scaffoldly/config/projects/dotnet.d.ts' {
  {"version":3,"file":"dotnet.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/config/projects/dotnet.ts"],"names":[],"mappings":"AACA,OAAO,EAAkB,WAAW,EAAmC,MAAM,IAAI,CAAC;AAElF,OAAO,EAAE,eAAe,EAAE,MAAM,GAAG,CAAC;AAGpC,MAAM,MAAM,MAAM,GAAG;IACnB,OAAO,CAAC,EAAE;QACR,aAAa,CAAC,EAAE,KAAK,CAAC;YACpB,OAAO,CAAC,EAAE,KAAK,CAAC,MAAM,CAAC,CAAC;YACxB,UAAU,CAAC,EAAE,KAAK,CAAC;gBACjB,OAAO,CAAC,EAAE,KAAK,CAAC,MAAM,CAAC,CAAC;gBACxB,OAAO,CAAC,EAAE,KAAK,CAAC,MAAM,CAAC,CAAC;gBACxB,GAAG,CAAC,EAAE,KAAK,CAAC;oBACV,CAAC,CAAC,EAAE;wBACF,IAAI,CAAC,EAAE,MAAM,CAAC;qBACf,CAAC;oBACF,CAAC,EAAE,MAAM,CAAC;iBACX,CAAC,CAAC;gBACH,OAAO,CAAC,EAAE,KAAK,CAAC;oBACd,CAAC,CAAC,EAAE;wBACF,IAAI,CAAC,EAAE,MAAM,CAAC;qBACf,CAAC;oBACF,IAAI,EAAE,KAAK,CAAC,MAAM,CAAC,CAAC;oBACpB,MAAM,CAAC,EAAE,KAAK,CAAC;wBACb,CAAC,CAAC,EAAE;4BACF,IAAI,CAAC,EAAE,MAAM,CAAC;yBACf,CAAC;wBACF,CAAC,EAAE,MAAM,CAAC;qBACX,CAAC,CAAC;iBACJ,CAAC,CAAC;aACJ,CAAC,CAAC;SACJ,CAAC,CAAC;QACH,SAAS,CAAC,EAAE,KAAK,CAAC;YAChB,gBAAgB,CAAC,EAAE;gBACjB,CAAC,CAAC,EAAE;oBACF,OAAO,CAAC,EAAE,MAAM,CAAC;oBACjB,OAAO,CAAC,EAAE,MAAM,CAAC;iBAClB,CAAC;aACH,EAAE,CAAC;SACL,CAAC,CAAC;KACJ,CAAC;CACH,CAAC;AAEF,qBAAa,aAAc,SAAQ,eAAe;IAC1C,UAAU,CAEd,KAAK,EAAE,MAAM,GACZ,OAAO,CAAC,IAAI,CAAC;IAQhB,OAAO,KAAK,WAAW,GAWtB;IAED,OAAO,KAAK,OAAO,GAWlB;IAED,IAAI,WAAW,IAAI,OAAO,CAAC,WAAW,GAAG,SAAS,CAAC,CAqElD;CACF"}
}
declare module 'scaffoldly/config/projects/golang' {
  import { ProjectJson } from 'scaffoldly/config/index';
  import { AbstractProject } from 'scaffoldly/config/projects/index';
  export class GolangProject extends AbstractProject {
      setProject(name: string): Promise<void>;
      private get goModFile();
      private get goProject();
      get projectJson(): Promise<ProjectJson | undefined>;
  }
  //# sourceMappingURL=golang.d.ts.map
}
declare module 'scaffoldly/config/projects/golang.d.ts' {
  {"version":3,"file":"golang.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/config/projects/golang.ts"],"names":[],"mappings":"AACA,OAAO,EAAE,WAAW,EAAE,MAAM,IAAI,CAAC;AAEjC,OAAO,EAAE,eAAe,EAAE,MAAM,GAAG,CAAC;AAQpC,qBAAa,aAAc,SAAQ,eAAe;IAC1C,UAAU,CAAC,IAAI,EAAE,MAAM,GAAG,OAAO,CAAC,IAAI,CAAC;IAqB7C,OAAO,KAAK,SAAS,GASpB;IAED,OAAO,KAAK,SAAS,GAwDpB;IAED,IAAI,WAAW,IAAI,OAAO,CAAC,WAAW,GAAG,SAAS,CAAC,CAwBlD;CACF"}
}
declare module 'scaffoldly/config/projects/index' {
  import { Commands, IScaffoldlyConfig, ProjectJson } from 'scaffoldly/config/index';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  export abstract class AbstractProject {
      private gitService?;
      private workDir?;
      constructor(gitService?: GitService | undefined, workDir?: string | undefined);
      get workdir(): Promise<string>;
      abstract setProject(name: string): Promise<void>;
      abstract get projectJson(): Promise<ProjectJson | undefined>;
      get standaloneConfigFile(): Promise<string | undefined>;
      get standaloneConfig(): Promise<Partial<IScaffoldlyConfig> | undefined>;
      get installCommands(): Promise<Commands | undefined>;
  }
  //# sourceMappingURL=index.d.ts.map
}
declare module 'scaffoldly/config/projects/index.d.ts' {
  {"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/config/projects/index.ts"],"names":[],"mappings":"AACA,OAAO,EAAE,QAAQ,EAAE,iBAAiB,EAAE,WAAW,EAAoB,MAAM,IAAI,CAAC;AAChF,OAAO,EAAE,UAAU,EAAE,MAAM,kCAAkC,CAAC;AAG9D,8BAAsB,eAAe;IACvB,OAAO,CAAC,UAAU,CAAC;IAAc,OAAO,CAAC,OAAO,CAAC;gBAAzC,UAAU,CAAC,EAAE,UAAU,YAAA,EAAU,OAAO,CAAC,EAAE,MAAM,YAAA;IAErE,IAAI,OAAO,IAAI,OAAO,CAAC,MAAM,CAAC,CAQ7B;IAED,QAAQ,CAAC,UAAU,CAAC,IAAI,EAAE,MAAM,GAAG,OAAO,CAAC,IAAI,CAAC;IAEhD,QAAQ,KAAK,WAAW,IAAI,OAAO,CAAC,WAAW,GAAG,SAAS,CAAC,CAAC;IAE7D,IAAI,oBAAoB,IAAI,OAAO,CAAC,MAAM,GAAG,SAAS,CAAC,CAQtD;IAED,IAAI,gBAAgB,IAAI,OAAO,CAAC,OAAO,CAAC,iBAAiB,CAAC,GAAG,SAAS,CAAC,CAetE;IAED,IAAI,eAAe,IAAI,OAAO,CAAC,QAAQ,GAAG,SAAS,CAAC,CAcnD;CACF"}
}
declare module 'scaffoldly/config/projects/node' {
  import { ProjectJson } from 'scaffoldly/config/index';
  import { AbstractProject } from 'scaffoldly/config/projects/index';
  export type PackageJson = ProjectJson;
  export class NodeProject extends AbstractProject {
      setProject(name: string): Promise<void>;
      private get packageJsonFile();
      private get packageJson();
      get projectJson(): Promise<ProjectJson | undefined>;
  }
  //# sourceMappingURL=node.d.ts.map
}
declare module 'scaffoldly/config/projects/node.d.ts' {
  {"version":3,"file":"node.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/config/projects/node.ts"],"names":[],"mappings":"AACA,OAAO,EAAE,WAAW,EAAE,MAAM,IAAI,CAAC;AAEjC,OAAO,EAAE,eAAe,EAAE,MAAM,GAAG,CAAC;AAEpC,MAAM,MAAM,WAAW,GAAG,WAAW,CAAC;AAEtC,qBAAa,WAAY,SAAQ,eAAe;IACxC,UAAU,CAAC,IAAI,EAAE,MAAM,GAAG,OAAO,CAAC,IAAI,CAAC;IAa7C,OAAO,KAAK,eAAe,GAS1B;IAED,OAAO,KAAK,WAAW,GAYtB;IAED,IAAI,WAAW,IAAI,OAAO,CAAC,WAAW,GAAG,SAAS,CAAC,CAElD;CACF"}
}
declare module 'scaffoldly/config/projects/python' {
  import { ProjectJson } from 'scaffoldly/config/index';
  import { AbstractProject } from 'scaffoldly/config/projects/index';
  export class PythonProject extends AbstractProject {
      setProject(name: string): Promise<void>;
      private get pyProjectFile();
      private get pyProject();
      get projectJson(): Promise<ProjectJson | undefined>;
  }
  //# sourceMappingURL=python.d.ts.map
}
declare module 'scaffoldly/config/projects/python.d.ts' {
  {"version":3,"file":"python.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/config/projects/python.ts"],"names":[],"mappings":"AACA,OAAO,EAAqC,WAAW,EAAE,MAAM,IAAI,CAAC;AAEpE,OAAO,EAAE,eAAe,EAAE,MAAM,GAAG,CAAC;AAqBpC,qBAAa,aAAc,SAAQ,eAAe;IAC1C,UAAU,CAAC,IAAI,EAAE,MAAM,GAAG,OAAO,CAAC,IAAI,CAAC;IAgB7C,OAAO,KAAK,aAAa,GASxB;IAED,OAAO,KAAK,SAAS,GAUpB;IAED,IAAI,WAAW,IAAI,OAAO,CAAC,WAAW,GAAG,SAAS,CAAC,CAgDlD;CACF"}
}
declare module 'scaffoldly/config/projects/rust' {
  import { ProjectJson } from 'scaffoldly/config/index';
  import { AbstractProject } from 'scaffoldly/config/projects/index';
  export class RustProject extends AbstractProject {
      setProject(name: string): Promise<void>;
      private get cargoTomlFile();
      private get rustProject();
      get projectJson(): Promise<ProjectJson | undefined>;
  }
  //# sourceMappingURL=rust.d.ts.map
}
declare module 'scaffoldly/config/projects/rust.d.ts' {
  {"version":3,"file":"rust.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/config/projects/rust.ts"],"names":[],"mappings":"AACA,OAAO,EAAqB,WAAW,EAAE,MAAM,IAAI,CAAC;AAEpD,OAAO,EAAE,eAAe,EAAE,MAAM,GAAG,CAAC;AAepC,qBAAa,WAAY,SAAQ,eAAe;IACxC,UAAU,CAAC,IAAI,EAAE,MAAM,GAAG,OAAO,CAAC,IAAI,CAAC;IAoB7C,OAAO,KAAK,aAAa,GASxB;IAED,OAAO,KAAK,WAAW,GAUtB;IAED,IAAI,WAAW,IAAI,OAAO,CAAC,WAAW,GAAG,SAAS,CAAC,CA4BlD;CACF"}
}
declare module 'scaffoldly/config/projects/standalone' {
  import { ProjectJson } from 'scaffoldly/config/index';
  import { AbstractProject } from 'scaffoldly/config/projects/index';
  export class StandaloneProject extends AbstractProject {
      setProject(name: string): Promise<void>;
      get projectJson(): Promise<ProjectJson | undefined>;
  }
  //# sourceMappingURL=standalone.d.ts.map
}
declare module 'scaffoldly/config/projects/standalone.d.ts' {
  {"version":3,"file":"standalone.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/config/projects/standalone.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,WAAW,EAAE,MAAM,IAAI,CAAC;AACjC,OAAO,EAAE,eAAe,EAAE,MAAM,GAAG,CAAC;AAGpC,qBAAa,iBAAkB,SAAQ,eAAe;IAC9C,UAAU,CAAC,IAAI,EAAE,MAAM,GAAG,OAAO,CAAC,IAAI,CAAC;IAe7C,IAAI,WAAW,IAAI,OAAO,CAAC,WAAW,GAAG,SAAS,CAAC,CAalD;CACF"}
}
declare module 'scaffoldly/create-app' {
  export const run: () => Promise<void>;
  //# sourceMappingURL=create-app.d.ts.map
}
declare module 'scaffoldly/create-app.d.ts' {
  {"version":3,"file":"create-app.d.ts","sourceRoot":"","sources":["../../../home/runner/work/scaffoldly/scaffoldly/src/create-app.ts"],"names":[],"mappings":"AA+RA,eAAO,MAAM,GAAG,QAAa,OAAO,CAAC,IAAI,CAiNxC,CAAC"}
}
declare module 'scaffoldly/github-action/action' {
  import { Status } from 'scaffoldly/github-action/status';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  import { ApiHelper } from 'scaffoldly/scaffoldly/helpers/apiHelper';
  import { MessagesHelper } from 'scaffoldly/scaffoldly/helpers/messagesHelper';
  import { Scms } from 'scaffoldly/scaffoldly/stores/scms';
  import { EventService } from 'scaffoldly/scaffoldly/event';
  export type Mode = 'pre' | 'main' | 'post';
  export class Action {
      private mode;
      eventService: EventService;
      gitService: GitService;
      apiHelper: ApiHelper;
      messagesHelper: MessagesHelper;
      scms: Scms;
      _token?: string;
      _sha?: string;
      _branch?: string;
      constructor(mode: Mode, version?: string);
      init(): Promise<Action>;
      pre(status: Status): Promise<Status>;
      main(status: Status): Promise<Status>;
      post(status: Status): Promise<Status>;
      get logsUrl(): Promise<string>;
      get workingDirectory(): string;
      get operation(): 'deploy' | undefined;
      get token(): string;
      get idToken(): Promise<string>;
      get commitSha(): string;
      get owner(): string;
      get repo(): string;
  }
  //# sourceMappingURL=action.d.ts.map
}
declare module 'scaffoldly/github-action/action.d.ts' {
  {"version":3,"file":"action.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/github-action/action.ts"],"names":[],"mappings":"AAIA,OAAO,EAAE,MAAM,EAAE,MAAM,UAAU,CAAC;AAClC,OAAO,EAAE,UAAU,EAAE,MAAM,+BAA+B,CAAC;AAG3D,OAAO,EAAE,SAAS,EAAE,MAAM,iCAAiC,CAAC;AAC5D,OAAO,EAAE,cAAc,EAAE,MAAM,sCAAsC,CAAC;AACtE,OAAO,EAAE,IAAI,EAAE,MAAM,2BAA2B,CAAC;AAGjD,OAAO,EAAE,YAAY,EAAE,MAAM,qBAAqB,CAAC;AAInD,MAAM,MAAM,IAAI,GAAG,KAAK,GAAG,MAAM,GAAG,MAAM,CAAC;AAE3C,qBAAa,MAAM;IAiBL,OAAO,CAAC,IAAI;IAhBxB,YAAY,EAAE,YAAY,CAAC;IAE3B,UAAU,EAAE,UAAU,CAAC;IAEvB,SAAS,EAAE,SAAS,CAAC;IAErB,cAAc,EAAE,cAAc,CAAC;IAE/B,IAAI,EAAE,IAAI,CAAC;IAEX,MAAM,CAAC,EAAE,MAAM,CAAC;IAEhB,IAAI,CAAC,EAAE,MAAM,CAAC;IAEd,OAAO,CAAC,EAAE,MAAM,CAAC;gBAEG,IAAI,EAAE,IAAI,EAAE,OAAO,CAAC,EAAE,MAAM;IAQ1C,IAAI,IAAI,OAAO,CAAC,MAAM,CAAC;IASvB,GAAG,CAAC,MAAM,EAAE,MAAM,GAAG,OAAO,CAAC,MAAM,CAAC;IAuEpC,IAAI,CAAC,MAAM,EAAE,MAAM,GAAG,OAAO,CAAC,MAAM,CAAC;IAsDrC,IAAI,CAAC,MAAM,EAAE,MAAM,GAAG,OAAO,CAAC,MAAM,CAAC;IAmB3C,IAAI,OAAO,IAAI,OAAO,CAAC,MAAM,CAAC,CAgC7B;IAED,IAAI,gBAAgB,IAAI,MAAM,CAY7B;IAED,IAAI,SAAS,IAAI,QAAQ,GAAG,SAAS,CAYpC;IAED,IAAI,KAAK,IAAI,MAAM,CAKlB;IAED,IAAI,OAAO,IAAI,OAAO,CAAC,MAAM,CAAC,CAS7B;IAED,IAAI,SAAS,IAAI,MAAM,CAKtB;IAED,IAAI,KAAK,IAAI,MAAM,CAElB;IAED,IAAI,IAAI,IAAI,MAAM,CAEjB;CACF"}
}
declare module 'scaffoldly/github-action/messages' {
  import { Status } from 'scaffoldly/github-action/status';
  export type Message = {
      longMessage: string;
      shortMessage: string;
  };
  export const deployedMarkdown: (status: Status) => Promise<Message>;
  export const failedMarkdown: (status: Status, moreInfo?: string) => Promise<Message>;
  //# sourceMappingURL=messages.d.ts.map
}
declare module 'scaffoldly/github-action/messages.d.ts' {
  {"version":3,"file":"messages.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/github-action/messages.ts"],"names":[],"mappings":"AAGA,OAAO,EAAE,MAAM,EAAE,MAAM,UAAU,CAAC;AAIlC,MAAM,MAAM,OAAO,GAAG;IACpB,WAAW,EAAE,MAAM,CAAC;IACpB,YAAY,EAAE,MAAM,CAAC;CACtB,CAAC;AAEF,eAAO,MAAM,gBAAgB,WAAkB,MAAM,KAAG,OAAO,CAAC,OAAO,CAItE,CAAC;AAEF,eAAO,MAAM,cAAc,WAAkB,MAAM,aAAa,MAAM,KAAG,OAAO,CAAC,OAAO,CAIvF,CAAC"}
}
declare module 'scaffoldly/github-action/status' {
  import { DeployStatus } from 'scaffoldly/scaffoldly/commands/cd/aws/index';
  export type Status = DeployStatus & {
      sessionId?: number;
      failed?: boolean;
      commitSha?: string;
      deployLogsUrl?: string;
      shortMessage?: string;
      longMessage?: string;
      owner?: string;
      repo?: string;
  };
  //# sourceMappingURL=status.d.ts.map
}
declare module 'scaffoldly/github-action/status.d.ts' {
  {"version":3,"file":"status.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/github-action/status.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,YAAY,EAAE,MAAM,+BAA+B,CAAC;AAE7D,MAAM,MAAM,MAAM,GAAG,YAAY,GAAG;IAClC,SAAS,CAAC,EAAE,MAAM,CAAC;IACnB,MAAM,CAAC,EAAE,OAAO,CAAC;IACjB,SAAS,CAAC,EAAE,MAAM,CAAC;IACnB,aAAa,CAAC,EAAE,MAAM,CAAC;IACvB,YAAY,CAAC,EAAE,MAAM,CAAC;IACtB,WAAW,CAAC,EAAE,MAAM,CAAC;IACrB,KAAK,CAAC,EAAE,MAAM,CAAC;IACf,IAAI,CAAC,EAAE,MAAM,CAAC;CACf,CAAC"}
}
declare module 'scaffoldly/github-action' {
  import { Mode } from 'scaffoldly/github-action/action';
  export const run: (mode: Mode, version?: string) => Promise<void>;
  //# sourceMappingURL=github-action.d.ts.map
}
declare module 'scaffoldly/github-action.d.ts' {
  {"version":3,"file":"github-action.d.ts","sourceRoot":"","sources":["../../../home/runner/work/scaffoldly/scaffoldly/src/github-action.ts"],"names":[],"mappings":"AAEA,OAAO,EAAU,IAAI,EAAE,MAAM,wBAAwB,CAAC;AA6BtD,eAAO,MAAM,GAAG,SAAgB,IAAI,YAAY,MAAM,KAAG,OAAO,CAAC,IAAI,CA+CpE,CAAC"}
}
declare module 'scaffoldly/index' {
  export { run as createApp } from 'scaffoldly/create-app';
  //# sourceMappingURL=index.d.ts.map
}
declare module 'scaffoldly/index.d.ts' {
  {"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../home/runner/work/scaffoldly/scaffoldly/src/index.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,GAAG,IAAI,SAAS,EAAE,MAAM,cAAc,CAAC"}
}
declare module 'scaffoldly/scaffoldly/command' {
  import { Answers, QuestionCollection } from 'inquirer';
  import { BottomBar } from 'scaffoldly/scaffoldly/ui';
  import Prompt from 'inquirer/lib/ui/prompt';
  export const ui: BottomBar;
  export const prompt: (field: string, questions: QuestionCollection<Answers>, initialAnswers?: Partial<Answers>, stream?: NodeJS.WriteStream) => Promise<Answers> & {
      ui: Prompt<Answers>;
  };
  export class Command {
      private version?;
      private apiHelper;
      private messagesHelper;
      private gitService;
      private eventService;
      constructor(argv: string[], version?: string | undefined);
      run(argv: string[]): Promise<void>;
      private loginWrapper;
  }
  //# sourceMappingURL=command.d.ts.map
}
declare module 'scaffoldly/scaffoldly/command.d.ts' {
  {"version":3,"file":"command.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/command.ts"],"names":[],"mappings":"AAEA,OAAiB,EAAE,OAAO,EAAE,kBAAkB,EAAE,MAAM,UAAU,CAAC;AAQjE,OAAO,EAAE,SAAS,EAAc,MAAM,MAAM,CAAC;AAC7C,OAAO,MAAM,MAAM,wBAAwB,CAAC;AAM5C,eAAO,MAAM,EAAE,WAAgC,CAAC;AAEhD,eAAO,MAAM,MAAM,UACV,MAAM,aACF,kBAAkB,CAAC,OAAO,CAAC,mBACrB,OAAO,CAAC,OAAO,CAAC,WACxB,MAAM,CAAC,WAAW,KAC1B,OAAO,CAAC,OAAO,CAAC,GAAG;IAAE,EAAE,EAAE,MAAM,CAAC,OAAO,CAAC,CAAA;CAK1C,CAAC;AAEF,qBAAa,OAAO;IASU,OAAO,CAAC,OAAO,CAAC;IAR5C,OAAO,CAAC,SAAS,CAAY;IAE7B,OAAO,CAAC,cAAc,CAAiB;IAEvC,OAAO,CAAC,UAAU,CAAa;IAE/B,OAAO,CAAC,YAAY,CAAe;gBAEvB,IAAI,EAAE,MAAM,EAAE,EAAU,OAAO,CAAC,EAAE,MAAM,YAAA;IASvC,GAAG,CAAC,IAAI,EAAE,MAAM,EAAE,GAAG,OAAO,CAAC,IAAI,CAAC;IA6M/C,OAAO,CAAC,YAAY,CA2BlB;CACH"}
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/dynamodb' {
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  import { IamConsumer, PolicyDocument } from 'scaffoldly/scaffoldly/commands/cd/aws/iam';
  export class DynamoDbService implements IamConsumer {
      private gitService;
      constructor(gitService: GitService);
      get tableArns(): string[];
      get trustRelationship(): undefined;
      get policyDocument(): PolicyDocument | undefined;
  }
  //# sourceMappingURL=dynamodb.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/dynamodb.d.ts' {
  {"version":3,"file":"dynamodb.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/cd/aws/dynamodb.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,UAAU,EAAE,MAAM,QAAQ,CAAC;AACpC,OAAO,EAAE,WAAW,EAAE,cAAc,EAAE,MAAM,OAAO,CAAC;AAEpD,qBAAa,eAAgB,YAAW,WAAW;IACrC,OAAO,CAAC,UAAU;gBAAV,UAAU,EAAE,UAAU;IAE1C,IAAI,SAAS,IAAI,MAAM,EAAE,CAIxB;IAED,IAAI,iBAAiB,IAAI,SAAS,CAEjC;IAED,IAAI,cAAc,IAAI,cAAc,GAAG,SAAS,CAc/C;CACF"}
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/ecr' {
  import { ECRClient } from '@aws-sdk/client-ecr';
  import { AuthConfig } from 'dockerode';
  import { ResourceOptions } from 'scaffoldly/scaffoldly/commands/cd/index';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  import { IdentityStatus } from 'scaffoldly/scaffoldly/commands/cd/aws/iam';
  export type EcrDeployStatus = {
      repositoryUri?: string;
  };
  export interface RegistryAuthConsumer {
      get authConfig(): Promise<AuthConfig>;
  }
  export class EcrService implements RegistryAuthConsumer {
      private gitService;
      ecrClient: ECRClient;
      constructor(gitService: GitService);
      predeploy(status: IdentityStatus & EcrDeployStatus, options: ResourceOptions): Promise<void>;
      get authConfig(): Promise<AuthConfig>;
  }
  //# sourceMappingURL=ecr.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/ecr.d.ts' {
  {"version":3,"file":"ecr.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/cd/aws/ecr.ts"],"names":[],"mappings":"AAAA,OAAO,EACL,SAAS,EAQV,MAAM,qBAAqB,CAAC;AAC7B,OAAO,EAAE,UAAU,EAAE,MAAM,WAAW,CAAC;AACvC,OAAO,EAAiB,eAAe,EAAE,MAAM,IAAI,CAAC;AAGpD,OAAO,EAAE,UAAU,EAAE,MAAM,QAAQ,CAAC;AACpC,OAAO,EAAE,cAAc,EAAE,MAAM,OAAO,CAAC;AAEvC,MAAM,MAAM,eAAe,GAAG;IAC5B,aAAa,CAAC,EAAE,MAAM,CAAC;CACxB,CAAC;AAEF,MAAM,WAAW,oBAAoB;IACnC,IAAI,UAAU,IAAI,OAAO,CAAC,UAAU,CAAC,CAAC;CACvC;AAED,qBAAa,UAAW,YAAW,oBAAoB;IAGzC,OAAO,CAAC,UAAU;IAF9B,SAAS,EAAE,SAAS,CAAC;gBAED,UAAU,EAAE,UAAU;IAI7B,SAAS,CACpB,MAAM,EAAE,cAAc,GAAG,eAAe,EACxC,OAAO,EAAE,eAAe,GACvB,OAAO,CAAC,IAAI,CAAC;IAgDhB,IAAI,UAAU,IAAI,OAAO,CAAC,UAAU,CAAC,CAyCpC;CACF"}
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/iam' {
  import { IAMClient } from '@aws-sdk/client-iam';
  import { STSClient } from '@aws-sdk/client-sts';
  import { ResourceOptions } from 'scaffoldly/scaffoldly/commands/cd/index';
  import { SecretDeployStatus } from 'scaffoldly/scaffoldly/commands/cd/aws/secret';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  export type IdentityStatus = {
      accountId?: string;
      region?: string;
  };
  export type IamDeployStatus = {
      roleArn?: string;
  };
  export type TrustRelationship = {
      Version: string;
      Statement: {
          Effect: 'Allow';
          Principal: {
              Service: string;
          };
          Action: 'sts:AssumeRole';
      }[];
  };
  export type PolicyDocument = {
      Version: string;
      Statement: {
          Sid?: string;
          Effect: 'Allow';
          Action: string[];
          Resource: string[];
          Condition?: {
              StringEquals?: Record<string, string | string[]>;
          };
      }[];
  };
  export interface IamConsumer {
      get trustRelationship(): TrustRelationship | undefined;
      get policyDocument(): PolicyDocument | undefined;
  }
  export class IamService {
      private gitService;
      iamClient: IAMClient;
      stsClient: STSClient;
      constructor(gitService: GitService);
      identity(status: IdentityStatus, options: ResourceOptions): Promise<void>;
      predeploy(status: IamDeployStatus & SecretDeployStatus, consumers: IamConsumer[], options: ResourceOptions): Promise<void>;
  }
  //# sourceMappingURL=iam.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/iam.d.ts' {
  {"version":3,"file":"iam.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/cd/aws/iam.ts"],"names":[],"mappings":"AAAA,OAAO,EAGL,SAAS,EAQV,MAAM,qBAAqB,CAAC;AAC7B,OAAO,EAIL,SAAS,EACV,MAAM,qBAAqB,CAAC;AAC7B,OAAO,EAAiB,eAAe,EAAE,MAAM,IAAI,CAAC;AACpD,OAAO,EAAE,kBAAkB,EAAE,MAAM,UAAU,CAAC;AAC9C,OAAO,EAAE,UAAU,EAAE,MAAM,QAAQ,CAAC;AAEpC,MAAM,MAAM,cAAc,GAAG;IAC3B,SAAS,CAAC,EAAE,MAAM,CAAC;IACnB,MAAM,CAAC,EAAE,MAAM,CAAC;CACjB,CAAC;AAEF,MAAM,MAAM,eAAe,GAAG;IAC5B,OAAO,CAAC,EAAE,MAAM,CAAC;CAClB,CAAC;AAEF,MAAM,MAAM,iBAAiB,GAAG;IAC9B,OAAO,EAAE,MAAM,CAAC;IAChB,SAAS,EAAE;QACT,MAAM,EAAE,OAAO,CAAC;QAChB,SAAS,EAAE;YACT,OAAO,EAAE,MAAM,CAAC;SACjB,CAAC;QACF,MAAM,EAAE,gBAAgB,CAAC;KAC1B,EAAE,CAAC;CACL,CAAC;AAaF,MAAM,MAAM,cAAc,GAAG;IAC3B,OAAO,EAAE,MAAM,CAAC;IAChB,SAAS,EAAE;QACT,GAAG,CAAC,EAAE,MAAM,CAAC;QACb,MAAM,EAAE,OAAO,CAAC;QAChB,MAAM,EAAE,MAAM,EAAE,CAAC;QACjB,QAAQ,EAAE,MAAM,EAAE,CAAC;QACnB,SAAS,CAAC,EAAE;YACV,YAAY,CAAC,EAAE,MAAM,CAAC,MAAM,EAAE,MAAM,GAAG,MAAM,EAAE,CAAC,CAAC;SAClD,CAAC;KACH,EAAE,CAAC;CACL,CAAC;AAWF,MAAM,WAAW,WAAW;IAC1B,IAAI,iBAAiB,IAAI,iBAAiB,GAAG,SAAS,CAAC;IACvD,IAAI,cAAc,IAAI,cAAc,GAAG,SAAS,CAAC;CAClD;AAED,qBAAa,UAAU;IAKT,OAAO,CAAC,UAAU;IAJ9B,SAAS,EAAE,SAAS,CAAC;IAErB,SAAS,EAAE,SAAS,CAAC;gBAED,UAAU,EAAE,UAAU;IAK7B,QAAQ,CAAC,MAAM,EAAE,cAAc,EAAE,OAAO,EAAE,eAAe,GAAG,OAAO,CAAC,IAAI,CAAC;IA2FzE,SAAS,CACpB,MAAM,EAAE,eAAe,GAAG,kBAAkB,EAC5C,SAAS,EAAE,WAAW,EAAE,EACxB,OAAO,EAAE,eAAe,GACvB,OAAO,CAAC,IAAI,CAAC;CA0FjB"}
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/index' {
  import { LambdaDeployStatus, LambdaService } from 'scaffoldly/scaffoldly/commands/cd/aws/lambda';
  import { ResourceOptions } from 'scaffoldly/scaffoldly/commands/cd/index';
  import { IamDeployStatus, IamService, IdentityStatus } from 'scaffoldly/scaffoldly/commands/cd/aws/iam';
  import { EcrDeployStatus, EcrService } from 'scaffoldly/scaffoldly/commands/cd/aws/ecr';
  import { DockerDeployStatus, DockerService } from 'scaffoldly/scaffoldly/commands/cd/docker/index';
  import { SecretDeployStatus, SecretService } from 'scaffoldly/scaffoldly/commands/cd/aws/secret';
  import { GitDeployStatus, GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  import { EnvDeployStatus, EnvService } from 'scaffoldly/scaffoldly/commands/ci/env/index';
  import { ScheduleService, ScheduleDeployStatus } from 'scaffoldly/scaffoldly/commands/cd/aws/schedule';
  import { DynamoDbService } from 'scaffoldly/scaffoldly/commands/cd/aws/dynamodb';
  export type DeployStatus = GitDeployStatus & EnvDeployStatus & DockerDeployStatus & IdentityStatus & EcrDeployStatus & IamDeployStatus & SecretDeployStatus & LambdaDeployStatus & ScheduleDeployStatus;
  export class AwsService {
      private gitService;
      private envService;
      private dockerService;
      secretService: SecretService;
      iamService: IamService;
      ecrService: EcrService;
      lambdaService: LambdaService;
      dynamoDbService: DynamoDbService;
      scheduleService: ScheduleService;
      constructor(gitService: GitService, envService: EnvService, dockerService: DockerService);
      predeploy(status: DeployStatus, options: ResourceOptions): Promise<void>;
      deploy(status: DeployStatus, options: ResourceOptions): Promise<void>;
  }
  //# sourceMappingURL=index.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/index.d.ts' {
  {"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/cd/aws/index.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,kBAAkB,EAAE,aAAa,EAAE,MAAM,UAAU,CAAC;AAC7D,OAAO,EAAE,eAAe,EAAE,MAAM,IAAI,CAAC;AACrC,OAAO,EAAE,eAAe,EAAE,UAAU,EAAE,cAAc,EAAE,MAAM,OAAO,CAAC;AACpE,OAAO,EAAE,eAAe,EAAE,UAAU,EAAE,MAAM,OAAO,CAAC;AACpD,OAAO,EAAE,kBAAkB,EAAE,aAAa,EAAE,MAAM,WAAW,CAAC;AAC9D,OAAO,EAAE,kBAAkB,EAAE,aAAa,EAAE,MAAM,UAAU,CAAC;AAC7D,OAAO,EAAE,eAAe,EAAE,UAAU,EAAE,MAAM,QAAQ,CAAC;AACrD,OAAO,EAAE,eAAe,EAAE,UAAU,EAAE,MAAM,cAAc,CAAC;AAC3D,OAAO,EAAE,eAAe,EAAE,oBAAoB,EAAE,MAAM,YAAY,CAAC;AACnE,OAAO,EAAE,eAAe,EAAE,MAAM,YAAY,CAAC;AAE7C,MAAM,MAAM,YAAY,GAAG,eAAe,GACxC,eAAe,GACf,kBAAkB,GAClB,cAAc,GACd,eAAe,GACf,eAAe,GACf,kBAAkB,GAClB,kBAAkB,GAClB,oBAAoB,CAAC;AAEvB,qBAAa,UAAU;IAcnB,OAAO,CAAC,UAAU;IAClB,OAAO,CAAC,UAAU;IAClB,OAAO,CAAC,aAAa;IAfvB,aAAa,EAAE,aAAa,CAAC;IAE7B,UAAU,EAAE,UAAU,CAAC;IAEvB,UAAU,EAAE,UAAU,CAAC;IAEvB,aAAa,EAAE,aAAa,CAAC;IAE7B,eAAe,EAAE,eAAe,CAAC;IAEjC,eAAe,EAAE,eAAe,CAAC;gBAGvB,UAAU,EAAE,UAAU,EACtB,UAAU,EAAE,UAAU,EACtB,aAAa,EAAE,aAAa;IAUhC,SAAS,CAAC,MAAM,EAAE,YAAY,EAAE,OAAO,EAAE,eAAe,GAAG,OAAO,CAAC,IAAI,CAAC;IAiCxE,MAAM,CAAC,MAAM,EAAE,YAAY,EAAE,OAAO,EAAE,eAAe,GAAG,OAAO,CAAC,IAAI,CAAC;CAa5E"}
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/lambda' {
  import { LambdaClient } from '@aws-sdk/client-lambda';
  import { IamConsumer, PolicyDocument, TrustRelationship } from 'scaffoldly/scaffoldly/commands/cd/aws/iam';
  import { ResourceOptions } from 'scaffoldly/scaffoldly/commands/cd/index';
  import { EnvService } from 'scaffoldly/scaffoldly/commands/ci/env/index';
  import { DockerService } from 'scaffoldly/scaffoldly/commands/cd/docker/index';
  import { Architecture } from 'scaffoldly/scaffoldly/commands/ci/docker/index';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  export type LambdaDeployStatus = {
      functionArn?: string;
      functionVersion?: string;
      functionQualifier?: string;
      architecture?: Architecture;
      imageUri?: string;
      url?: string;
  };
  export class LambdaService implements IamConsumer {
      private gitService;
      private envService;
      private dockerService;
      lambdaClient: LambdaClient;
      constructor(gitService: GitService, envService: EnvService, dockerService: DockerService);
      predeploy(status: LambdaDeployStatus, options: ResourceOptions): Promise<void>;
      deploy(status: LambdaDeployStatus, options: ResourceOptions): Promise<void>;
      private configureFunction;
      private configureAlias;
      private configureUrl;
      private configurePermissions;
      private publishCode;
      get trustRelationship(): TrustRelationship;
      get policyDocument(): PolicyDocument;
  }
  //# sourceMappingURL=lambda.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/lambda.d.ts' {
  {"version":3,"file":"lambda.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/cd/aws/lambda.ts"],"names":[],"mappings":"AAAA,OAAO,EAML,YAAY,EAsBb,MAAM,wBAAwB,CAAC;AAChC,OAAO,EAAE,WAAW,EAAmB,cAAc,EAAE,iBAAiB,EAAE,MAAM,OAAO,CAAC;AAExF,OAAO,EAAiB,eAAe,EAAE,MAAM,IAAI,CAAC;AACpD,OAAO,EAAE,UAAU,EAAE,MAAM,cAAc,CAAC;AAC1C,OAAO,EAAsB,aAAa,EAAE,MAAM,WAAW,CAAC;AAC9D,OAAO,EAAE,YAAY,EAAE,MAAM,iBAAiB,CAAC;AAE/C,OAAO,EAAmB,UAAU,EAAE,MAAM,QAAQ,CAAC;AAGrD,MAAM,MAAM,kBAAkB,GAAG;IAC/B,WAAW,CAAC,EAAE,MAAM,CAAC;IACrB,eAAe,CAAC,EAAE,MAAM,CAAC;IACzB,iBAAiB,CAAC,EAAE,MAAM,CAAC;IAC3B,YAAY,CAAC,EAAE,YAAY,CAAC;IAC5B,QAAQ,CAAC,EAAE,MAAM,CAAC;IAClB,GAAG,CAAC,EAAE,MAAM,CAAC;CACd,CAAC;AAEF,qBAAa,aAAc,YAAW,WAAW;IAI7C,OAAO,CAAC,UAAU;IAClB,OAAO,CAAC,UAAU;IAClB,OAAO,CAAC,aAAa;IALvB,YAAY,EAAE,YAAY,CAAC;gBAGjB,UAAU,EAAE,UAAU,EACtB,UAAU,EAAE,UAAU,EACtB,aAAa,EAAE,aAAa;IAKzB,SAAS,CAAC,MAAM,EAAE,kBAAkB,EAAE,OAAO,EAAE,eAAe,GAAG,OAAO,CAAC,IAAI,CAAC;IAO9E,MAAM,CAAC,MAAM,EAAE,kBAAkB,EAAE,OAAO,EAAE,eAAe,GAAG,OAAO,CAAC,IAAI,CAAC;YAQ1E,iBAAiB;YAoGjB,cAAc;YA0Dd,YAAY;YAyDZ,oBAAoB;YA+DpB,WAAW;IAyEzB,IAAI,iBAAiB,IAAI,iBAAiB,CAazC;IAED,IAAI,cAAc,IAAI,cAAc,CAkBnC;CACF"}
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/schedule' {
  import { SchedulerClient } from '@aws-sdk/client-scheduler';
  import { ResourceOptions } from 'scaffoldly/scaffoldly/commands/cd/index';
  import { IamConsumer, IamDeployStatus, PolicyDocument, TrustRelationship } from 'scaffoldly/scaffoldly/commands/cd/aws/iam';
  import { LambdaClient } from '@aws-sdk/client-lambda';
  import { LambdaDeployStatus } from 'scaffoldly/scaffoldly/commands/cd/aws/lambda';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  export type ScheduleDeployStatus = {
      scheduleGroup?: string;
  };
  export type ScheduleGroup = {
      scheduleGroup: string;
  };
  export type ScheduledEvent = {
      scheduleName: string;
      scheduleGroup: string;
  };
  export class ScheduleService implements IamConsumer {
      private gitService;
      schedulerClient: SchedulerClient;
      lambdaClient: LambdaClient;
      constructor(gitService: GitService);
      predeploy(status: ScheduleDeployStatus, options: ResourceOptions): Promise<void>;
      deploy(status: ScheduleDeployStatus & LambdaDeployStatus & IamDeployStatus, options: ResourceOptions): Promise<void>;
      get trustRelationship(): TrustRelationship;
      get policyDocument(): PolicyDocument;
  }
  //# sourceMappingURL=schedule.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/schedule.d.ts' {
  {"version":3,"file":"schedule.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/cd/aws/schedule.ts"],"names":[],"mappings":"AACA,OAAO,EAYL,eAAe,EAEhB,MAAM,2BAA2B,CAAC;AACnC,OAAO,EAAiB,eAAe,EAAE,MAAM,IAAI,CAAC;AACpD,OAAO,EAAE,WAAW,EAAE,eAAe,EAAE,cAAc,EAAE,iBAAiB,EAAE,MAAM,OAAO,CAAC;AACxF,OAAO,EAIL,YAAY,EACb,MAAM,wBAAwB,CAAC;AAEhC,OAAO,EAAE,kBAAkB,EAAE,MAAM,UAAU,CAAC;AAC9C,OAAO,EAAE,UAAU,EAAE,MAAM,QAAQ,CAAC;AAKpC,MAAM,MAAM,oBAAoB,GAAG;IACjC,aAAa,CAAC,EAAE,MAAM,CAAC;CACxB,CAAC;AAEF,MAAM,MAAM,aAAa,GAAG;IAC1B,aAAa,EAAE,MAAM,CAAC;CACvB,CAAC;AAUF,MAAM,MAAM,cAAc,GAAG;IAC3B,YAAY,EAAE,MAAM,CAAC;IACrB,aAAa,EAAE,MAAM,CAAC;CACvB,CAAC;AAwEF,qBAAa,eAAgB,YAAW,WAAW;IAKrC,OAAO,CAAC,UAAU;IAJ9B,eAAe,EAAE,eAAe,CAAC;IAEjC,YAAY,EAAE,YAAY,CAAC;gBAEP,UAAU,EAAE,UAAU;IAK7B,SAAS,CAAC,MAAM,EAAE,oBAAoB,EAAE,OAAO,EAAE,eAAe,GAAG,OAAO,CAAC,IAAI,CAAC;IAwChF,MAAM,CACjB,MAAM,EAAE,oBAAoB,GAAG,kBAAkB,GAAG,eAAe,EACnE,OAAO,EAAE,eAAe,GACvB,OAAO,CAAC,IAAI,CAAC;IA0LhB,IAAI,iBAAiB,IAAI,iBAAiB,CAazC;IAED,IAAI,cAAc,IAAI,cAAc,CAWnC;CACF"}
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/secret' {
  import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
  import { ResourceOptions } from 'scaffoldly/scaffoldly/commands/cd/index';
  import { IamConsumer, PolicyDocument } from 'scaffoldly/scaffoldly/commands/cd/aws/iam';
  import { GitDeployStatus, GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  import { SecretConsumer } from 'scaffoldly/config/index';
  export type SecretName = string;
  export type SecretVersion = string;
  export type SecretDeployStatus = {
      secretId?: string;
      secretName?: string;
      uniqueId?: string;
  };
  export class SecretService implements IamConsumer {
      private gitService;
      secretsManagerClient: SecretsManagerClient;
      lastDeployStatus?: SecretDeployStatus;
      constructor(gitService: GitService);
      predeploy(status: SecretDeployStatus & GitDeployStatus, consumer: SecretConsumer, options: ResourceOptions): Promise<void>;
      get trustRelationship(): undefined;
      get policyDocument(): PolicyDocument | undefined;
  }
  //# sourceMappingURL=secret.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/cd/aws/secret.d.ts' {
  {"version":3,"file":"secret.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/cd/aws/secret.ts"],"names":[],"mappings":"AAAA,OAAO,EACL,oBAAoB,EAMrB,MAAM,iCAAiC,CAAC;AACzC,OAAO,EAAiB,eAAe,EAAE,MAAM,IAAI,CAAC;AAGpD,OAAO,EAAE,WAAW,EAAE,cAAc,EAAE,MAAM,OAAO,CAAC;AACpD,OAAO,EAAE,eAAe,EAAE,UAAU,EAAE,MAAM,QAAQ,CAAC;AACrD,OAAO,EAAE,cAAc,EAAE,MAAM,oBAAoB,CAAC;AAEpD,MAAM,MAAM,UAAU,GAAG,MAAM,CAAC;AAChC,MAAM,MAAM,aAAa,GAAG,MAAM,CAAC;AAEnC,MAAM,MAAM,kBAAkB,GAAG;IAC/B,QAAQ,CAAC,EAAE,MAAM,CAAC;IAClB,UAAU,CAAC,EAAE,MAAM,CAAC;IACpB,QAAQ,CAAC,EAAE,MAAM,CAAC;CACnB,CAAC;AAEF,qBAAa,aAAc,YAAW,WAAW;IAKnC,OAAO,CAAC,UAAU;IAJ9B,oBAAoB,EAAE,oBAAoB,CAAC;IAE3C,gBAAgB,CAAC,EAAE,kBAAkB,CAAC;gBAElB,UAAU,EAAE,UAAU;IAI7B,SAAS,CACpB,MAAM,EAAE,kBAAkB,GAAG,eAAe,EAC5C,QAAQ,EAAE,cAAc,EACxB,OAAO,EAAE,eAAe,GACvB,OAAO,CAAC,IAAI,CAAC;IA0DhB,IAAI,iBAAiB,IAAI,SAAS,CAEjC;IAED,IAAI,cAAc,IAAI,cAAc,GAAG,SAAS,CAe/C;CACF"}
}
declare module 'scaffoldly/scaffoldly/commands/cd/docker/index' {
  import { DockerService as DockerCiService } from 'scaffoldly/scaffoldly/commands/ci/docker/index';
  import { ResourceOptions } from 'scaffoldly/scaffoldly/commands/cd/index';
  import { EcrDeployStatus, RegistryAuthConsumer } from 'scaffoldly/scaffoldly/commands/cd/aws/ecr';
  import { LambdaDeployStatus } from 'scaffoldly/scaffoldly/commands/cd/aws/lambda';
  import { EnvDeployStatus } from 'scaffoldly/scaffoldly/commands/ci/env/index';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  export type Platform = 'linux/amd64' | 'linux/arm64';
  export type DockerDeployStatus = {
      imageTag?: string;
      imageName?: string;
      imageDigest?: string;
      imageSize?: number;
  };
  export class DockerService {
      private gitService;
      dockerCiService: DockerCiService;
      constructor(gitService: GitService, dockerCiService: DockerCiService);
      get platform(): Platform;
      predeploy(status: EcrDeployStatus & DockerDeployStatus, consumer: RegistryAuthConsumer, options: ResourceOptions): Promise<void>;
      deploy(status: DockerDeployStatus & EcrDeployStatus & EnvDeployStatus & LambdaDeployStatus, consumer: RegistryAuthConsumer, options: ResourceOptions): Promise<void>;
      build(status: DockerDeployStatus & EcrDeployStatus & EnvDeployStatus, options: ResourceOptions): Promise<void>;
      push(status: DockerDeployStatus & EcrDeployStatus, consumer: RegistryAuthConsumer, options: ResourceOptions): Promise<void>;
  }
  //# sourceMappingURL=index.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/cd/docker/index.d.ts' {
  {"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/cd/docker/index.ts"],"names":[],"mappings":"AAAA,OAAO,EAAa,aAAa,IAAI,eAAe,EAAY,MAAM,iBAAiB,CAAC;AACxF,OAAO,EAAiB,eAAe,EAAE,MAAM,IAAI,CAAC;AACpD,OAAO,EAAE,eAAe,EAAE,oBAAoB,EAAE,MAAM,YAAY,CAAC;AACnE,OAAO,EAAE,kBAAkB,EAAE,MAAM,eAAe,CAAC;AACnD,OAAO,EAAE,eAAe,EAAE,MAAM,cAAc,CAAC;AAC/C,OAAO,EAAE,UAAU,EAAE,MAAM,QAAQ,CAAC;AAGpC,MAAM,MAAM,QAAQ,GAAG,aAAa,GAAG,aAAa,CAAC;AAErD,MAAM,MAAM,kBAAkB,GAAG;IAC/B,QAAQ,CAAC,EAAE,MAAM,CAAC;IAClB,SAAS,CAAC,EAAE,MAAM,CAAC;IACnB,WAAW,CAAC,EAAE,MAAM,CAAC;IACrB,SAAS,CAAC,EAAE,MAAM,CAAC;CACpB,CAAC;AAEF,qBAAa,aAAa;IACZ,OAAO,CAAC,UAAU;IAAqB,eAAe,EAAE,eAAe;gBAA/D,UAAU,EAAE,UAAU,EAAS,eAAe,EAAE,eAAe;IAEnF,IAAI,QAAQ,IAAI,QAAQ,CAEvB;IAEY,SAAS,CACpB,MAAM,EAAE,eAAe,GAAG,kBAAkB,EAC5C,QAAQ,EAAE,oBAAoB,EAC9B,OAAO,EAAE,eAAe,GACvB,OAAO,CAAC,IAAI,CAAC;IAQH,MAAM,CACjB,MAAM,EAAE,kBAAkB,GAAG,eAAe,GAAG,eAAe,GAAG,kBAAkB,EACnF,QAAQ,EAAE,oBAAoB,EAC9B,OAAO,EAAE,eAAe,GACvB,OAAO,CAAC,IAAI,CAAC;IAUV,KAAK,CACT,MAAM,EAAE,kBAAkB,GAAG,eAAe,GAAG,eAAe,EAC9D,OAAO,EAAE,eAAe,GACvB,OAAO,CAAC,IAAI,CAAC;IA0BV,IAAI,CACR,MAAM,EAAE,kBAAkB,GAAG,eAAe,EAC5C,QAAQ,EAAE,oBAAoB,EAC9B,OAAO,EAAE,eAAe,GACvB,OAAO,CAAC,IAAI,CAAC;CAqCjB"}
}
declare module 'scaffoldly/scaffoldly/commands/cd/errors' {
  export class NotFoundException extends Error {
      constructor(message: string, cause?: Error);
  }
  export class SkipAction extends Error {
      constructor(message: string);
  }
  //# sourceMappingURL=errors.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/cd/errors.d.ts' {
  {"version":3,"file":"errors.d.ts","sourceRoot":"","sources":["../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/cd/errors.ts"],"names":[],"mappings":"AAAA,qBAAa,iBAAkB,SAAQ,KAAK;gBAC9B,OAAO,EAAE,MAAM,EAAE,KAAK,CAAC,EAAE,KAAK;CAK3C;AAED,qBAAa,UAAW,SAAQ,KAAK;gBACvB,OAAO,EAAE,MAAM;CAI5B"}
}
declare module 'scaffoldly/scaffoldly/commands/cd/git/index' {
  import { SimpleGit } from 'simple-git';
  import { ResourceOptions } from 'scaffoldly/scaffoldly/commands/cd/index';
  import { ScaffoldlyConfig } from 'scaffoldly/config/index';
  import { EventService } from 'scaffoldly/scaffoldly/event';
  export type GitDeployStatus = {
      branch?: string;
      defaultBranch?: string;
      alias?: string;
      remote?: string;
  };
  export type Origin = {
      host: string;
      path: string;
      protocol: 'git' | 'https';
      origin: string;
  };
  export class GitService {
      private eventService;
      private _workDir;
      _git?: SimpleGit;
      _config?: ScaffoldlyConfig;
      constructor(eventService: EventService, _workDir?: string, config?: ScaffoldlyConfig);
      get config(): ScaffoldlyConfig;
      setConfig(config: ScaffoldlyConfig): void;
      get baseDir(): Promise<string>;
      get workDir(): Promise<string>;
      get git(): Promise<SimpleGit>;
      predeploy(status: GitDeployStatus, _options: ResourceOptions): Promise<void>;
      get defaultBranch(): Promise<string | undefined>;
      get branch(): Promise<'tagged' | string | undefined>;
      get origin(): Promise<Origin | undefined>;
      get remote(): Promise<string | undefined>;
      get sha(): Promise<string>;
      get tag(): string;
  }
  //# sourceMappingURL=index.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/cd/git/index.d.ts' {
  {"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/cd/git/index.ts"],"names":[],"mappings":"AACA,OAAO,EAAa,SAAS,EAAE,MAAM,YAAY,CAAC;AAClD,OAAO,EAAE,eAAe,EAAE,MAAM,IAAI,CAAC;AAGrC,OAAO,EAAE,gBAAgB,EAAE,MAAM,oBAAoB,CAAC;AACtD,OAAO,EAAE,YAAY,EAAE,MAAM,gBAAgB,CAAC;AAE9C,MAAM,MAAM,eAAe,GAAG;IAC5B,MAAM,CAAC,EAAE,MAAM,CAAC;IAChB,aAAa,CAAC,EAAE,MAAM,CAAC;IACvB,KAAK,CAAC,EAAE,MAAM,CAAC;IACf,MAAM,CAAC,EAAE,MAAM,CAAC;CACjB,CAAC;AAEF,MAAM,MAAM,MAAM,GAAG;IACnB,IAAI,EAAE,MAAM,CAAC;IACb,IAAI,EAAE,MAAM,CAAC;IACb,QAAQ,EAAE,KAAK,GAAG,OAAO,CAAC;IAC1B,MAAM,EAAE,MAAM,CAAC;CAChB,CAAC;AAEF,qBAAa,UAAU;IAMnB,OAAO,CAAC,YAAY;IACpB,OAAO,CAAC,QAAQ;IANlB,IAAI,CAAC,EAAE,SAAS,CAAC;IAEjB,OAAO,CAAC,EAAE,gBAAgB,CAAC;gBAGjB,YAAY,EAAE,YAAY,EAC1B,QAAQ,SAAgB,EAChC,MAAM,CAAC,EAAE,gBAAgB;IAO3B,IAAI,MAAM,IAAI,gBAAgB,CAK7B;IAED,SAAS,CAAC,MAAM,EAAE,gBAAgB,GAAG,IAAI;IAKzC,IAAI,OAAO,IAAI,OAAO,CAAC,MAAM,CAAC,CAI7B;IAED,IAAI,OAAO,IAAI,OAAO,CAAC,MAAM,CAAC,CAE7B;IAED,IAAI,GAAG,IAAI,OAAO,CAAC,SAAS,CAAC,CAc5B;IAEY,SAAS,CAEpB,MAAM,EAAE,eAAe,EAEvB,QAAQ,EAAE,eAAe,GACxB,OAAO,CAAC,IAAI,CAAC;IAchB,IAAI,aAAa,IAAI,OAAO,CAAC,MAAM,GAAG,SAAS,CAAC,CAsB/C;IAED,IAAI,MAAM,IAAI,OAAO,CAAC,QAAQ,GAAG,MAAM,GAAG,SAAS,CAAC,CAenD;IAED,IAAI,MAAM,IAAI,OAAO,CAAC,MAAM,GAAG,SAAS,CAAC,CAoBxC;IAED,IAAI,MAAM,IAAI,OAAO,CAAC,MAAM,GAAG,SAAS,CAAC,CAOxC;IAED,IAAI,GAAG,IAAI,OAAO,CAAC,MAAM,CAAC,CAazB;IAED,IAAI,GAAG,IAAI,MAAM,CAwBhB;CACF"}
}
declare module 'scaffoldly/scaffoldly/commands/cd/index' {
  import { Command } from 'scaffoldly/scaffoldly/commands/index';
  import { Mode } from 'scaffoldly/config/index';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  export type ResourceOptions = {
      retries?: number;
      notify?: (message: string, level?: 'notice' | 'error') => void;
      dev?: boolean;
      checkPermissions?: boolean;
      buildOnly?: boolean;
      dryRun?: boolean;
      permissionsAware?: PermissionAware;
  };
  export type ResourceExtractor<Resource, ReadCommandOutput> = (output: Partial<ReadCommandOutput>) => Partial<Resource> | undefined;
  export class CloudResource<Resource, ReadCommandOutput> implements PromiseLike<Partial<Resource>> {
      readonly requests: {
          describe: (resource: Partial<Resource>) => {
              type: string;
              label: string;
          };
          read: () => Promise<ReadCommandOutput>;
          create?: () => Promise<unknown>;
          update?: (resource: Partial<Resource>) => Promise<unknown>;
          dispose?: (resource: Partial<Resource>) => Promise<unknown>;
          emitPermissions?: (aware: PermissionAware) => void;
      };
      private readonly resourceExtractor;
      private options;
      private desired?;
      constructor(requests: {
          describe: (resource: Partial<Resource>) => {
              type: string;
              label: string;
          };
          read: () => Promise<ReadCommandOutput>;
          create?: () => Promise<unknown>;
          update?: (resource: Partial<Resource>) => Promise<unknown>;
          dispose?: (resource: Partial<Resource>) => Promise<unknown>;
          emitPermissions?: (aware: PermissionAware) => void;
      }, resourceExtractor: ResourceExtractor<Resource, ReadCommandOutput>);
      then<TResult1 = Partial<Resource>, TResult2 = never>(onfulfilled?: ((value: Partial<Resource>) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): PromiseLike<TResult1 | TResult2>;
      manage(options: ResourceOptions, desired?: Partial<ReadCommandOutput>): CloudResource<Resource, ReadCommandOutput>;
      _manage(options: ResourceOptions, desired?: Partial<ReadCommandOutput>): Promise<Partial<Resource>>;
      dispose(): Promise<Partial<Resource>>;
      private read;
      private create;
      private update;
      logResource(action: 'Reading' | 'Creating' | 'Created' | 'Updating' | 'Updated', resource: Partial<Resource | undefined> | Error, options: ResourceOptions): void;
  }
  export abstract class CdCommand<T> extends Command<T> {
      protected gitService: GitService;
      constructor(gitService: GitService, mode: Mode);
  }
  export interface PermissionAware {
      withPermissions(permissions: string[]): void;
      get permissions(): string[];
  }
  //# sourceMappingURL=index.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/cd/index.d.ts' {
  {"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/cd/index.ts"],"names":[],"mappings":"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"}
}
declare module 'scaffoldly/scaffoldly/commands/ci/aws/lambda/function-url-server' {
  import { APIGatewayProxyEventQueryStringParameters } from 'aws-lambda';
  import { HttpServer } from 'scaffoldly/scaffoldly/commands/ci/http/http-server';
  import { LambdaRuntimeServer } from 'scaffoldly/scaffoldly/commands/ci/aws/lambda/lambda-runtime-server';
  import { Request } from 'express';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  type ApiGatewayHaders = {
      [header: string]: string;
  };
  export const REMAP_RESPONSE_HEADERS: string[];
  export const DROP_RESPONSE_HEADERS: string[];
  export const convertHeaders: (headers?: Record<string, unknown>, requestId?: string) => ApiGatewayHaders;
  export const convertQueryString: (request: Request) => APIGatewayProxyEventQueryStringParameters;
  export const convertBody: (request: Request) => string | undefined;
  export class FunctionUrlServer extends HttpServer {
      private gitService;
      private lambdaRuntimeServer;
      apiId: string;
      constructor(gitService: GitService, lambdaRuntimeServer: LambdaRuntimeServer);
      registerHandlers(): Promise<void>;
  }
  export {};
  //# sourceMappingURL=function-url-server.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/ci/aws/lambda/function-url-server.d.ts' {
  {"version":3,"file":"function-url-server.d.ts","sourceRoot":"","sources":["../../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/ci/aws/lambda/function-url-server.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,yCAAyC,EAA0B,MAAM,YAAY,CAAC;AAC/F,OAAO,EAAE,UAAU,EAAE,MAAM,wBAAwB,CAAC;AACpD,OAAO,EAAE,mBAAmB,EAAE,MAAM,yBAAyB,CAAC;AAG9D,OAAO,EAAE,OAAO,EAAE,MAAM,SAAS,CAAC;AAGlC,OAAO,EAAE,UAAU,EAAE,MAAM,iBAAiB,CAAC;AAE7C,KAAK,gBAAgB,GAAG;IACtB,CAAC,MAAM,EAAE,MAAM,GAAG,MAAM,CAAC;CAC1B,CAAC;AAGF,eAAO,MAAM,sBAAsB,UASlC,CAAC;AAEF,eAAO,MAAM,qBAAqB,UAWjC,CAAC;AAEF,eAAO,MAAM,cAAc,aACf,MAAM,CAAC,MAAM,EAAE,OAAO,CAAC,cACrB,MAAM,KACjB,gBAsDF,CAAC;AAEF,eAAO,MAAM,kBAAkB,YAAa,OAAO,KAAG,yCAgBrD,CAAC;AAEF,eAAO,MAAM,WAAW,YAAa,OAAO,KAAG,MAAM,GAAG,SAKvD,CAAC;AAkCF,qBAAa,iBAAkB,SAAQ,UAAU;IAInC,OAAO,CAAC,UAAU;IAAc,OAAO,CAAC,mBAAmB;IAFvE,KAAK,SAA0C;gBAE3B,UAAU,EAAE,UAAU,EAAU,mBAAmB,EAAE,mBAAmB;IAItF,gBAAgB,IAAI,OAAO,CAAC,IAAI,CAAC;CA4ExC"}
}
declare module 'scaffoldly/scaffoldly/commands/ci/aws/lambda/lambda-runtime-server' {
  import { Request, Response } from 'express';
  import { HttpServer, HttpServerOptions } from 'scaffoldly/scaffoldly/commands/ci/http/http-server';
  import { AsyncSubject, Observable } from 'rxjs';
  import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
  import { ContainerPool } from 'scaffoldly/scaffoldly/commands/ci/docker/container-pool';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  export const RUNTIME_SERVER_PORT = 9001;
  type ResonseSubject = AsyncSubject<APIGatewayProxyStructuredResultV2 | undefined>;
  interface Invocation {
      requestId: string;
      event: APIGatewayProxyEventV2;
      response$: ResonseSubject;
  }
  interface NextRequest {
      req: Request;
      res: Response;
      hasError: () => boolean;
  }
  export class LambdaRuntimeServer extends HttpServer {
      private gitService;
      private containerPool;
      protected options: HttpServerOptions;
      private invocations$;
      private request$;
      constructor(gitService: GitService, containerPool: ContainerPool, options?: HttpServerOptions);
      observeInvocations(): Observable<{
          nextRequest: NextRequest;
          nextInvocation: Invocation;
      }>;
      handleInvocation(nextRequest: NextRequest, nextInvocation: Invocation): void;
      registerHandlers(): Promise<void>;
      emit(event: APIGatewayProxyEventV2): ResonseSubject;
  }
  export {};
  //# sourceMappingURL=lambda-runtime-server.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/ci/aws/lambda/lambda-runtime-server.d.ts' {
  {"version":3,"file":"lambda-runtime-server.d.ts","sourceRoot":"","sources":["../../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/ci/aws/lambda/lambda-runtime-server.ts"],"names":[],"mappings":"AAAA,OAAO,EAAQ,OAAO,EAAE,QAAQ,EAAE,MAAM,SAAS,CAAC;AAClD,OAAO,EAAE,UAAU,EAAE,iBAAiB,EAAE,MAAM,wBAAwB,CAAC;AACvE,OAAO,EACL,YAAY,EAEZ,UAAU,EAMX,MAAM,MAAM,CAAC;AACd,OAAO,EAAE,sBAAsB,EAAE,iCAAiC,EAAE,MAAM,YAAY,CAAC;AACvF,OAAO,EAAE,aAAa,EAAE,MAAM,6BAA6B,CAAC;AAC5D,OAAO,EAAE,UAAU,EAAE,MAAM,iBAAiB,CAAC;AAS7C,eAAO,MAAM,mBAAmB,OAAO,CAAC;AAExC,KAAK,cAAc,GAAG,YAAY,CAAC,iCAAiC,GAAG,SAAS,CAAC,CAAC;AAElF,UAAU,UAAU;IAClB,SAAS,EAAE,MAAM,CAAC;IAClB,KAAK,EAAE,sBAAsB,CAAC;IAC9B,SAAS,EAAE,cAAc,CAAC;CAC3B;AAED,UAAU,WAAW;IACnB,GAAG,EAAE,OAAO,CAAC;IACb,GAAG,EAAE,QAAQ,CAAC;IACd,QAAQ,EAAE,MAAM,OAAO,CAAC;CACzB;AAED,qBAAa,mBAAoB,SAAQ,UAAU;IAM/C,OAAO,CAAC,UAAU;IAClB,OAAO,CAAC,aAAa;IACrB,SAAS,CAAC,OAAO,EAAE,iBAAiB;IAPtC,OAAO,CAAC,YAAY,CAAyC;IAE7D,OAAO,CAAC,QAAQ,CAA8B;gBAGpC,UAAU,EAAE,UAAU,EACtB,aAAa,EAAE,aAAa,EAC1B,OAAO,GAAE,iBAElB;IAmBH,kBAAkB,IAAI,UAAU,CAAC;QAC/B,WAAW,EAAE,WAAW,CAAC;QACzB,cAAc,EAAE,UAAU,CAAC;KAC5B,CAAC;IAqBF,gBAAgB,CAAC,WAAW,EAAE,WAAW,EAAE,cAAc,EAAE,UAAU,GAAG,IAAI;IA0DtE,gBAAgB,IAAI,OAAO,CAAC,IAAI,CAAC;IAqBvC,IAAI,CAAC,KAAK,EAAE,sBAAsB,GAAG,cAAc;CAcpD"}
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/container-pool' {
  import Dockerode from 'dockerode';
  import { DockerService } from 'scaffoldly/scaffoldly/commands/ci/docker/index';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  import { EnvService } from 'scaffoldly/scaffoldly/commands/ci/env/index';
  import { DevServer } from 'scaffoldly/scaffoldly/commands/ci/server/dev-server';
  export type ContainerRef = {
      name: string;
      runtimeApi: string;
      disposed?: boolean;
  };
  export type ContainerPoolMap = Map<string, ContainerRef>;
  export class ContainerPool extends DevServer {
      private gitService;
      private envService;
      protected readonly options: {
          lifetime: number;
          maxConcurrency: number;
      };
      private dockerAbortController;
      private abortSignal;
      protected readonly docker: Dockerode;
      private _imageName?;
      private pool;
      private pending$;
      private started$;
      private starting$;
      private garbage$;
      private deleted$;
      private subscriptions;
      private concurrency$;
      constructor(abortController: AbortController, gitService: GitService, dockerService: DockerService, envService: EnvService, options?: {
          lifetime: number;
          maxConcurrency: number;
      });
      get imageName(): string;
      set imageName(name: string);
      setConcurrency(desired?: number): void;
      start(): Promise<void>;
      stop(): Promise<void>;
      private createContainer;
      private startContainer;
      private removeContainer;
      private get mounts();
  }
  //# sourceMappingURL=container-pool.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/container-pool.d.ts' {
  {"version":3,"file":"container-pool.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/ci/docker/container-pool.ts"],"names":[],"mappings":"AAAA,OAAO,SAAS,MAAM,WAAW,CAAC;AAElC,OAAO,EAAE,aAAa,EAAE,MAAM,GAAG,CAAC;AAClC,OAAO,EAAE,UAAU,EAAE,MAAM,cAAc,CAAC;AAC1C,OAAO,EAAE,UAAU,EAAE,MAAM,QAAQ,CAAC;AAGpC,OAAO,EAAE,SAAS,EAAE,MAAM,sBAAsB,CAAC;AAKjD,MAAM,MAAM,YAAY,GAAG;IACzB,IAAI,EAAE,MAAM,CAAC;IACb,UAAU,EAAE,MAAM,CAAC;IACnB,QAAQ,CAAC,EAAE,OAAO,CAAC;CACpB,CAAC;AAkBF,MAAM,MAAM,gBAAgB,GAAG,GAAG,CAAC,MAAM,EAAE,YAAY,CAAC,CAAC;AAEzD,qBAAa,aAAc,SAAQ,SAAS;IA8BxC,OAAO,CAAC,UAAU;IAElB,OAAO,CAAC,UAAU;IAClB,SAAS,CAAC,QAAQ,CAAC,OAAO;;;;IAhC5B,OAAO,CAAC,qBAAqB,CAAyB;IAEtD,OAAO,CAAC,WAAW,CAAqC;IAExD,SAAS,CAAC,QAAQ,CAAC,MAAM,EAAE,SAAS,CAAC;IAErC,OAAO,CAAC,UAAU,CAAC,CAAS;IAE5B,OAAO,CAAC,IAAI,CAA+B;IAE3C,OAAO,CAAC,QAAQ,CAAwB;IAExC,OAAO,CAAC,QAAQ,CAAwB;IAExC,OAAO,CAAC,SAAS,CAAwB;IAEzC,OAAO,CAAC,QAAQ,CAAwB;IAExC,OAAO,CAAC,QAAQ,CAAwB;IAExC,OAAO,CAAC,aAAa,CAAsB;IAE3C,OAAO,CAAC,YAAY,CACsC;gBAKxD,eAAe,EAAE,eAAe,EACxB,UAAU,EAAE,UAAU,EAC9B,aAAa,EAAE,aAAa,EACpB,UAAU,EAAE,UAAU,EACX,OAAO;;;KAAwC;IA2BpE,IAAI,SAAS,IAAI,MAAM,CAKtB;IAED,IAAI,SAAS,CAAC,IAAI,EAAE,MAAM,EAEzB;IAED,cAAc,CAAC,OAAO,SAAkC,GAAG,IAAI;IAMzD,KAAK,IAAI,OAAO,CAAC,IAAI,CAAC;IA2BtB,IAAI,IAAI,OAAO,CAAC,IAAI,CAAC;YAKb,eAAe;YAsEf,cAAc;YAYd,eAAe;IAe7B,OAAO,KAAK,MAAM,GA8BjB;CACF"}
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/index' {
  import Docker, { AuthConfig } from 'dockerode';
  import { Script, ScaffoldlyConfig, Commands, Shell, ServiceName } from 'scaffoldly/config/index';
  import { Platform } from 'scaffoldly/scaffoldly/commands/cd/docker/index';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  export type BuildInfo = {
      imageName?: string;
      imageTag?: string;
      imageSize?: number;
      entrypoint?: string[];
  };
  export type PushInfo = {
      imageName?: string;
      imageDigest?: string;
  };
  export type Architecture = 'x86_64' | 'arm64' | 'match-host';
  export type Copy = {
      from?: string;
      src: string;
      dest: string;
      binDir?: boolean;
      noGlob?: boolean;
      absolute?: boolean;
      resolve?: boolean;
      entrypoint?: boolean;
      mode?: number;
  };
  export type RunCommand = {
      workdir?: string;
      cmds: string[];
      prerequisite: boolean;
  };
  type DockerStage = {
      [key: string]: DockerFileSpec | undefined;
  };
  type DockerStages = {
      cwd: string;
      bases: DockerStage;
      builds: DockerStage;
      packages: DockerStage;
      runtime: DockerFileSpec;
  };
  type DockerFileSpec = {
      from: string;
      as: string;
      rootdir: string;
      workdir?: string;
      copy?: Copy[];
      env?: {
          [key: string]: string | undefined;
      };
      run?: RunCommand[];
      paths?: string[];
      cmd?: Commands;
      shell?: Shell;
      user?: string;
  };
  export class DockerService {
      private gitService;
      docker: Docker;
      private imageName?;
      private imageTag?;
      private imageDigest?;
      private imageInfo?;
      private _platform?;
      private _withIgnoredFiles?;
      constructor(gitService: GitService);
      withIgnoredFiles(files: string[]): DockerService;
      get platform(): Platform;
      private handleDockerEvent;
      describeBuild(config: ScaffoldlyConfig): Promise<BuildInfo>;
      generateDockerfile(cwd: string, config: ScaffoldlyConfig, env?: Record<string, string>): Promise<{
          dockerfile: string;
          stages: DockerStages;
      }>;
      build(config: ScaffoldlyConfig, mode: Script, repositoryUri?: string, env?: Record<string, string>): Promise<void>;
      createStages(cwd: string, config: ScaffoldlyConfig, env?: Record<string, string>): Promise<DockerStages>;
      createStage(config: ScaffoldlyConfig, mode: Script, fromStages: DockerStage, env?: Record<string, string>): Promise<DockerStage>;
      createSpec(config: ScaffoldlyConfig, mode: Script, name: ServiceName, fromStages: DockerStage, env?: Record<string, string>): Promise<DockerFileSpec | undefined>;
      renderStages: (stages: DockerStages) => string;
      renderSpec: (mode: Script, cwd: string, spec: DockerFileSpec | undefined, ix: number) => string;
      describePush(config: ScaffoldlyConfig): Promise<PushInfo>;
      push(config: ScaffoldlyConfig, repositoryUri?: string, imageName?: string, authConfig?: AuthConfig): Promise<{
          imageDigest?: string;
      }>;
      private getImages;
      private getImage;
      private pullImage;
      private getPlatform;
      checkBin<T extends string[]>(runtime: string, bins: [...T], platform: Platform): Promise<T[number] | undefined>;
  }
  export {};
  //# sourceMappingURL=index.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/index.d.ts' {
  {"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/ci/docker/index.ts"],"names":[],"mappings":"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"}
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/packages/index' {
  import { ScaffoldlyConfig } from 'scaffoldly/config/index';
  import { Copy, DockerService, RunCommand } from 'scaffoldly/scaffoldly/commands/ci/docker/index';
  import { NpmPackageService } from 'scaffoldly/scaffoldly/commands/ci/docker/packages/npm';
  import { OsPackageService } from 'scaffoldly/scaffoldly/commands/ci/docker/packages/os';
  import { PipPackageService } from 'scaffoldly/scaffoldly/commands/ci/docker/packages/pip';
  export class PackageService {
      private dockerService;
      private config;
      osPackages: OsPackageService;
      npmPackages: NpmPackageService;
      pipPackages: PipPackageService;
      constructor(dockerService: DockerService, config: ScaffoldlyConfig);
      get entrypoint(): Copy;
      get paths(): Promise<string[]>;
      get commands(): Promise<RunCommand[]>;
  }
  //# sourceMappingURL=index.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/packages/index.d.ts' {
  {"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/ci/docker/packages/index.ts"],"names":[],"mappings":"AAAA,OAAO,EAAoB,gBAAgB,EAAE,MAAM,uBAAuB,CAAC;AAC3E,OAAO,EAAE,IAAI,EAAE,aAAa,EAAE,UAAU,EAAE,MAAM,IAAI,CAAC;AACrD,OAAO,EAAE,iBAAiB,EAAE,MAAM,OAAO,CAAC;AAC1C,OAAO,EAAE,gBAAgB,EAAE,MAAM,MAAM,CAAC;AAGxC,OAAO,EAAE,iBAAiB,EAAE,MAAM,OAAO,CAAC;AAE1C,qBAAa,cAAc;IAOb,OAAO,CAAC,aAAa;IAAiB,OAAO,CAAC,MAAM;IANhE,UAAU,EAAE,gBAAgB,CAAC;IAE7B,WAAW,EAAE,iBAAiB,CAAC;IAE/B,WAAW,EAAE,iBAAiB,CAAC;gBAEX,aAAa,EAAE,aAAa,EAAU,MAAM,EAAE,gBAAgB;IAMlF,IAAI,UAAU,IAAI,IAAI,CAoBrB;IAED,IAAI,KAAK,IAAI,OAAO,CAAC,MAAM,EAAE,CAAC,CAO7B;IAED,IAAI,QAAQ,IAAI,OAAO,CAAC,UAAU,EAAE,CAAC,CAapC;CACF"}
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/packages/npm' {
  import { RunCommand } from 'scaffoldly/scaffoldly/commands/ci/docker/index';
  import { ScaffoldlyConfig } from 'scaffoldly/config/index';
  export class NpmPackageService {
      private config;
      packages: string[];
      constructor(config: ScaffoldlyConfig);
      get dependencies(): Record<string, string>;
      get paths(): Promise<string[]>;
      get commands(): Promise<RunCommand[]>;
      get npm(): RunCommand[];
  }
  //# sourceMappingURL=npm.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/packages/npm.d.ts' {
  {"version":3,"file":"npm.d.ts","sourceRoot":"","sources":["../../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/ci/docker/packages/npm.ts"],"names":[],"mappings":"AACA,OAAO,EAAE,UAAU,EAAE,MAAM,IAAI,CAAC;AAChC,OAAO,EAAE,gBAAgB,EAAE,MAAM,uBAAuB,CAAC;AAEzD,qBAAa,iBAAiB;IAGhB,OAAO,CAAC,MAAM;IAF1B,QAAQ,EAAE,MAAM,EAAE,CAAC;gBAEC,MAAM,EAAE,gBAAgB;IA6B5C,IAAI,YAAY,IAAI,MAAM,CAAC,MAAM,EAAE,MAAM,CAAC,CAKzC;IAED,IAAI,KAAK,IAAI,OAAO,CAAC,MAAM,EAAE,CAAC,CAY7B;IAED,IAAI,QAAQ,IAAI,OAAO,CAAC,UAAU,EAAE,CAAC,CAOpC;IAED,IAAI,GAAG,IAAI,UAAU,EAAE,CAUtB;CACF"}
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/packages/os' {
  import { ScaffoldlyConfig } from 'scaffoldly/config/index';
  import { DockerService, RunCommand } from 'scaffoldly/scaffoldly/commands/ci/docker/index';
  export class OsPackageService {
      private dockerService;
      private config;
      packages: string[];
      constructor(dockerService: DockerService, config: ScaffoldlyConfig);
      get paths(): Promise<string[]>;
      get commands(): Promise<RunCommand[]>;
      get apk(): RunCommand[];
      get apt(): RunCommand[];
      get dnf(): RunCommand[];
      get yum(): RunCommand[];
  }
  //# sourceMappingURL=os.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/packages/os.d.ts' {
  {"version":3,"file":"os.d.ts","sourceRoot":"","sources":["../../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/ci/docker/packages/os.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,gBAAgB,EAAE,MAAM,uBAAuB,CAAC;AACzD,OAAO,EAAE,aAAa,EAAE,UAAU,EAAE,MAAM,IAAI,CAAC;AAE/C,qBAAa,gBAAgB;IAGf,OAAO,CAAC,aAAa;IAAiB,OAAO,CAAC,MAAM;IAFhE,QAAQ,EAAE,MAAM,EAAE,CAAC;gBAEC,aAAa,EAAE,aAAa,EAAU,MAAM,EAAE,gBAAgB;IAOlF,IAAI,KAAK,IAAI,OAAO,CAAC,MAAM,EAAE,CAAC,CAG7B;IAED,IAAI,QAAQ,IAAI,OAAO,CAAC,UAAU,EAAE,CAAC,CAqCpC;IAED,IAAI,GAAG,IAAI,UAAU,EAAE,CAWtB;IAED,IAAI,GAAG,IAAI,UAAU,EAAE,CAWtB;IAED,IAAI,GAAG,IAAI,UAAU,EAAE,CAWtB;IAED,IAAI,GAAG,IAAI,UAAU,EAAE,CAWtB;CACF"}
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/packages/pip' {
  import { RunCommand } from 'scaffoldly/scaffoldly/commands/ci/docker/index';
  import { ScaffoldlyConfig } from 'scaffoldly/config/index';
  export class PipPackageService {
      private config;
      packages: string[];
      constructor(config: ScaffoldlyConfig);
      get dependencies(): Record<string, string>;
      get paths(): Promise<string[]>;
      get commands(): Promise<RunCommand[]>;
      get npm(): RunCommand[];
  }
  //# sourceMappingURL=pip.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/packages/pip.d.ts' {
  {"version":3,"file":"pip.d.ts","sourceRoot":"","sources":["../../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/ci/docker/packages/pip.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,UAAU,EAAE,MAAM,IAAI,CAAC;AAChC,OAAO,EAAE,gBAAgB,EAAE,MAAM,uBAAuB,CAAC;AAEzD,qBAAa,iBAAiB;IAGhB,OAAO,CAAC,MAAM;IAF1B,QAAQ,EAAE,MAAM,EAAE,CAAC;gBAEC,MAAM,EAAE,gBAAgB;IAsB5C,IAAI,YAAY,IAAI,MAAM,CAAC,MAAM,EAAE,MAAM,CAAC,CAKzC;IAED,IAAI,KAAK,IAAI,OAAO,CAAC,MAAM,EAAE,CAAC,CAI7B;IAED,IAAI,QAAQ,IAAI,OAAO,CAAC,UAAU,EAAE,CAAC,CAOpC;IAED,IAAI,GAAG,IAAI,UAAU,EAAE,CAOtB;CACF"}
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/protobuf/moby' {
  export type Trace = {
      hash?: string;
      command?: string;
      code?: number;
      message?: string;
  };
  export const decodeTrace: (str: string) => Partial<Trace> | undefined;
  //# sourceMappingURL=moby.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/ci/docker/protobuf/moby.d.ts' {
  {"version":3,"file":"moby.d.ts","sourceRoot":"","sources":["../../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/ci/docker/protobuf/moby.ts"],"names":[],"mappings":"AAqCA,MAAM,MAAM,KAAK,GAAG;IAClB,IAAI,CAAC,EAAE,MAAM,CAAC;IACd,OAAO,CAAC,EAAE,MAAM,CAAC;IACjB,IAAI,CAAC,EAAE,MAAM,CAAC;IACd,OAAO,CAAC,EAAE,MAAM,CAAC;CAClB,CAAC;AAEF,eAAO,MAAM,WAAW,QAAS,MAAM,KAAG,OAAO,CAAC,KAAK,CAAC,GAAG,SAc1D,CAAC"}
}
declare module 'scaffoldly/scaffoldly/commands/ci/env/index' {
  import { ResourceOptions } from 'scaffoldly/scaffoldly/commands/cd/index';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  import { SecretDeployStatus } from 'scaffoldly/scaffoldly/commands/cd/aws/secret';
  import { LambdaDeployStatus } from 'scaffoldly/scaffoldly/commands/cd/aws/lambda';
  export type EnvDeployStatus = {
      envFiles?: string[];
      buildEnv?: Record<string, string>;
  };
  export class EnvService {
      private gitService;
      private lastStatus?;
      constructor(gitService: GitService);
      predeploy(status: EnvDeployStatus & SecretDeployStatus & LambdaDeployStatus): Promise<void>;
      deploy(status: EnvDeployStatus & SecretDeployStatus & LambdaDeployStatus, _options: ResourceOptions): Promise<void>;
      private get baseEnv();
      get buildEnv(): Promise<Record<string, string>>;
      get runtimeEnv(): Promise<Record<string, string>>;
      get dockerEnv(): string[];
      get envFiles(): string[];
  }
  //# sourceMappingURL=index.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/ci/env/index.d.ts' {
  {"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/ci/env/index.ts"],"names":[],"mappings":"AACA,OAAO,EAAE,eAAe,EAAE,MAAM,UAAU,CAAC;AAI3C,OAAO,EAAE,UAAU,EAAE,MAAM,cAAc,CAAC;AAE1C,OAAO,EAAE,kBAAkB,EAAE,MAAM,qBAAqB,CAAC;AACzD,OAAO,EAAE,kBAAkB,EAAE,MAAM,qBAAqB,CAAC;AAEzD,MAAM,MAAM,eAAe,GAAG;IAC5B,QAAQ,CAAC,EAAE,MAAM,EAAE,CAAC;IACpB,QAAQ,CAAC,EAAE,MAAM,CAAC,MAAM,EAAE,MAAM,CAAC,CAAC;CACnC,CAAC;AAIF,qBAAa,UAAU;IAGT,OAAO,CAAC,UAAU;IAF9B,OAAO,CAAC,UAAU,CAAC,CAAe;gBAEd,UAAU,EAAE,UAAU;IAE7B,SAAS,CACpB,MAAM,EAAE,eAAe,GAAG,kBAAkB,GAAG,kBAAkB,GAChE,OAAO,CAAC,IAAI,CAAC;IASH,MAAM,CACjB,MAAM,EAAE,eAAe,GAAG,kBAAkB,GAAG,kBAAkB,EAEjE,QAAQ,EAAE,eAAe,GACxB,OAAO,CAAC,IAAI,CAAC;IAQhB,OAAO,KAAK,OAAO,GAKlB;IAED,IAAI,QAAQ,IAAI,OAAO,CAAC,MAAM,CAAC,MAAM,EAAE,MAAM,CAAC,CAAC,CA4B9C;IAED,IAAI,UAAU,IAAI,OAAO,CAAC,MAAM,CAAC,MAAM,EAAE,MAAM,CAAC,CAAC,CAWhD;IAED,IAAI,SAAS,IAAI,MAAM,EAAE,CAExB;IAED,IAAI,QAAQ,IAAI,MAAM,EAAE,CA2BvB;CACF"}
}
declare module 'scaffoldly/scaffoldly/commands/ci/http/http-server' {
  import { Express } from 'express';
  import { Server } from 'http';
  import { DevServer } from 'scaffoldly/scaffoldly/commands/ci/server/dev-server';
  export type HttpServerOptions = {
      timeout?: number;
  };
  export abstract class HttpServer extends DevServer {
      readonly port: number;
      protected readonly options: HttpServerOptions;
      protected readonly app: Express;
      protected server?: Server;
      constructor(name: string, port: number, abortController: AbortController, options?: HttpServerOptions);
      abstract registerHandlers(): Promise<void>;
      start(): Promise<void>;
      stop(): Promise<void>;
  }
  //# sourceMappingURL=http-server.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/ci/http/http-server.d.ts' {
  {"version":3,"file":"http-server.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/ci/http/http-server.ts"],"names":[],"mappings":"AAAA,OAAgB,EAAE,OAAO,EAAE,MAAM,SAAS,CAAC;AAC3C,OAAO,EAAE,MAAM,EAAE,MAAM,MAAM,CAAC;AAC9B,OAAO,EAAE,SAAS,EAAE,MAAM,sBAAsB,CAAC;AAEjD,MAAM,MAAM,iBAAiB,GAAG;IAC9B,OAAO,CAAC,EAAE,MAAM,CAAC;CAClB,CAAC;AAEF,8BAAsB,UAAW,SAAQ,SAAS;aAO9B,IAAI,EAAE,MAAM;IAE5B,SAAS,CAAC,QAAQ,CAAC,OAAO,EAAE,iBAAiB;IAR/C,SAAS,CAAC,QAAQ,CAAC,GAAG,EAAE,OAAO,CAAC;IAEhC,SAAS,CAAC,MAAM,CAAC,EAAE,MAAM,CAAC;gBAGxB,IAAI,EAAE,MAAM,EACI,IAAI,EAAE,MAAM,EAC5B,eAAe,EAAE,eAAe,EACb,OAAO,GAAE,iBAAsB;IAMpD,QAAQ,CAAC,gBAAgB,IAAI,OAAO,CAAC,IAAI,CAAC;IAE1C,KAAK,IAAI,OAAO,CAAC,IAAI,CAAC;IAsBhB,IAAI,IAAI,OAAO,CAAC,IAAI,CAAC;CAU5B"}
}
declare module 'scaffoldly/scaffoldly/commands/ci/index' {
  import { DockerService } from 'scaffoldly/scaffoldly/commands/ci/docker/index';
  import { Command } from 'scaffoldly/scaffoldly/commands/index';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  import { Mode } from 'scaffoldly/config/index';
  export abstract class CiCommand<T> extends Command<T> {
      dockerService: DockerService;
      constructor(gitService: GitService, mode: Mode);
  }
  //# sourceMappingURL=index.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/ci/index.d.ts' {
  {"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/ci/index.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,aAAa,EAAE,MAAM,UAAU,CAAC;AACzC,OAAO,EAAE,OAAO,EAAE,MAAM,UAAU,CAAC;AACnC,OAAO,EAAE,UAAU,EAAE,MAAM,WAAW,CAAC;AACvC,OAAO,EAAE,IAAI,EAAE,MAAM,iBAAiB,CAAC;AAEvC,8BAAsB,SAAS,CAAC,CAAC,CAAE,SAAQ,OAAO,CAAC,CAAC,CAAC;IACnD,aAAa,EAAE,aAAa,CAAC;gBAEjB,UAAU,EAAE,UAAU,EAAE,IAAI,EAAE,IAAI;CAI/C"}
}
declare module 'scaffoldly/scaffoldly/commands/ci/server/dev-server' {
  import { Observable } from 'rxjs';
  import { Writable } from 'stream';
  export type Lifecycle = 'started' | 'stopped';
  export type ServerStatus = {
      name: string;
      lifecycle?: Lifecycle;
      lifecycle$: Observable<Lifecycle>;
  };
  type LogOption = {
      cause?: unknown;
  };
  export abstract class DevServer {
      readonly name: string;
      readonly abortController: AbortController;
      private _lifecycle$;
      private _stdout;
      private _stdwarn;
      private _stderr;
      constructor(name: string, abortController: AbortController);
      get stdout(): Writable;
      get stderr(): Writable;
      log(message: string, opt?: LogOption): void;
      warn(message: string, opt?: LogOption): void;
      error(message: string, opt?: LogOption): void;
      get(): Promise<ServerStatus>;
      create(): Promise<void>;
      dispose(): Promise<void>;
      protected abstract start(): Promise<void>;
      protected abstract stop(): Promise<void>;
  }
  export {};
  //# sourceMappingURL=dev-server.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/ci/server/dev-server.d.ts' {
  {"version":3,"file":"dev-server.d.ts","sourceRoot":"","sources":["../../../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/ci/server/dev-server.ts"],"names":[],"mappings":"AAAA,OAAO,EAAmB,UAAU,EAAU,MAAM,MAAM,CAAC;AAC3D,OAAO,EAAE,QAAQ,EAAE,MAAM,QAAQ,CAAC;AAMlC,MAAM,MAAM,SAAS,GAAG,SAAS,GAAG,SAAS,CAAC;AAE9C,MAAM,MAAM,YAAY,GAAG;IACzB,IAAI,EAAE,MAAM,CAAC;IACb,SAAS,CAAC,EAAE,SAAS,CAAC;IACtB,UAAU,EAAE,UAAU,CAAC,SAAS,CAAC,CAAC;CACnC,CAAC;AAoDF,KAAK,SAAS,GAAG;IACf,KAAK,CAAC,EAAE,OAAO,CAAC;CACjB,CAAC;AAEF,8BAAsB,SAAS;aASD,IAAI,EAAE,MAAM;aAAkB,eAAe,EAAE,eAAe;IAR1F,OAAO,CAAC,WAAW,CAAyD;IAE5E,OAAO,CAAC,OAAO,CAAsD;IAErE,OAAO,CAAC,QAAQ,CAAuD;IAEvE,OAAO,CAAC,OAAO,CAAoD;gBAEvC,IAAI,EAAE,MAAM,EAAkB,eAAe,EAAE,eAAe;IAM1F,IAAI,MAAM,IAAI,QAAQ,CAErB;IAED,IAAI,MAAM,IAAI,QAAQ,CAErB;IAED,GAAG,CAAC,OAAO,EAAE,MAAM,EAAE,GAAG,CAAC,EAAE,SAAS,GAAG,IAAI;IAO3C,IAAI,CAAC,OAAO,EAAE,MAAM,EAAE,GAAG,CAAC,EAAE,SAAS,GAAG,IAAI;IAO5C,KAAK,CAAC,OAAO,EAAE,MAAM,EAAE,GAAG,CAAC,EAAE,SAAS,GAAG,IAAI;IAOvC,GAAG,IAAI,OAAO,CAAC,YAAY,CAAC;IAQ5B,MAAM,IAAI,OAAO,CAAC,IAAI,CAAC;IAKvB,OAAO,IAAI,OAAO,CAAC,IAAI,CAAC;IAM9B,SAAS,CAAC,QAAQ,CAAC,KAAK,IAAI,OAAO,CAAC,IAAI,CAAC;IAEzC,SAAS,CAAC,QAAQ,CAAC,IAAI,IAAI,OAAO,CAAC,IAAI,CAAC;CACzC"}
}
declare module 'scaffoldly/scaffoldly/commands/deploy' {
  import { CdCommand, ResourceOptions } from 'scaffoldly/scaffoldly/commands/cd/index';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  import { AwsService, DeployStatus } from 'scaffoldly/scaffoldly/commands/cd/aws/index';
  import { EnvService } from 'scaffoldly/scaffoldly/commands/ci/env/index';
  import { DockerService } from 'scaffoldly/scaffoldly/commands/cd/docker/index';
  import { Mode } from 'scaffoldly/config/index';
  export type PresetType = 'nextjs';
  export const PRESETS: PresetType[];
  export class DeployCommand extends CdCommand<DeployCommand> {
      protected gitService: GitService;
      envService: EnvService;
      awsService: AwsService;
      dockerService: DockerService;
      status: DeployStatus;
      options: ResourceOptions;
      constructor(gitService: GitService, mode?: Mode);
      withMode(mode?: Mode): DeployCommand;
      withStatus(status: DeployStatus): DeployCommand;
      withOptions(options: ResourceOptions): DeployCommand;
      handle(subcommand?: 'dockerfile' | 'show-config' | 'save-config'): Promise<void>;
      private _handle;
  }
  //# sourceMappingURL=deploy.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/deploy.d.ts' {
  {"version":3,"file":"deploy.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/deploy.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,SAAS,EAAE,eAAe,EAAE,MAAM,MAAM,CAAC;AAElD,OAAO,EAAE,UAAU,EAAE,MAAM,UAAU,CAAC;AACtC,OAAO,EAAE,UAAU,EAAE,YAAY,EAAE,MAAM,UAAU,CAAC;AAGpD,OAAO,EAAE,UAAU,EAAE,MAAM,UAAU,CAAC;AACtC,OAAO,EAAE,aAAa,EAAE,MAAM,aAAa,CAAC;AAE5C,OAAO,EAAE,IAAI,EAAE,MAAM,cAAc,CAAC;AAEpC,MAAM,MAAM,UAAU,GAAG,QAAQ,CAAC;AAClC,eAAO,MAAM,OAAO,EAAE,UAAU,EAAe,CAAC;AAEhD,qBAAa,aAAc,SAAQ,SAAS,CAAC,aAAa,CAAC;IAW7C,SAAS,CAAC,UAAU,EAAE,UAAU;IAV5C,UAAU,EAAE,UAAU,CAAC;IAEvB,UAAU,EAAE,UAAU,CAAC;IAEvB,aAAa,EAAE,aAAa,CAAC;IAE7B,MAAM,EAAE,YAAY,CAAM;IAE1B,OAAO,EAAE,eAAe,CAAM;gBAER,UAAU,EAAE,UAAU,EAAE,IAAI,GAAE,IAAmB;IAOvE,QAAQ,CAAC,IAAI,CAAC,EAAE,IAAI,GAAG,aAAa;IAKpC,UAAU,CAAC,MAAM,EAAE,YAAY,GAAG,aAAa;IAK/C,WAAW,CAAC,OAAO,EAAE,eAAe,GAAG,aAAa;IAK9C,MAAM,CAAC,UAAU,CAAC,EAAE,YAAY,GAAG,aAAa,GAAG,aAAa,GAAG,OAAO,CAAC,IAAI,CAAC;YAuCxE,OAAO;CA8BtB"}
}
declare module 'scaffoldly/scaffoldly/commands/dev' {
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  import { CiCommand } from 'scaffoldly/scaffoldly/commands/ci/index';
  import { FunctionUrlServer } from 'scaffoldly/scaffoldly/commands/ci/aws/lambda/function-url-server';
  import { LambdaRuntimeServer } from 'scaffoldly/scaffoldly/commands/ci/aws/lambda/lambda-runtime-server';
  import { ResourceOptions } from 'scaffoldly/scaffoldly/commands/cd/index';
  import { DeployCommand } from 'scaffoldly/scaffoldly/commands/deploy';
  import { DeployStatus } from 'scaffoldly/scaffoldly/commands/cd/aws/index';
  import { ContainerPool } from 'scaffoldly/scaffoldly/commands/ci/docker/container-pool';
  import { ServerStatus } from 'scaffoldly/scaffoldly/commands/ci/server/dev-server';
  type DevStatus = DeployStatus & {
      lambdaRuntimeServer?: Partial<ServerStatus>;
      functionUrlServer?: Partial<ServerStatus>;
      containerPool?: Partial<ServerStatus>;
  };
  export class DevCommand extends CiCommand<DevCommand> {
      protected gitService: GitService;
      abortController: AbortController;
      containerPool: ContainerPool;
      lambdaRuntimeServer: LambdaRuntimeServer;
      functionUrlServer: FunctionUrlServer;
      deployCommand: DeployCommand;
      status: DevStatus;
      options?: ResourceOptions;
      constructor(gitService: GitService);
      handle(): Promise<void>;
      private _handle;
      configureLambdaRuntimeServer(status: DevStatus, options: ResourceOptions): Promise<void>;
      configureFunctionUrlServer(status: DevStatus, options: ResourceOptions): Promise<void>;
      configureContainerPool(status: DevStatus, options: ResourceOptions): Promise<void>;
      private waitForShutdown;
      private registerShutdownHooks;
  }
  export {};
  //# sourceMappingURL=dev.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/dev.d.ts' {
  {"version":3,"file":"dev.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/dev.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,UAAU,EAAE,MAAM,UAAU,CAAC;AACtC,OAAO,EAAE,SAAS,EAAE,MAAM,MAAM,CAAC;AACjC,OAAO,EAAE,iBAAiB,EAAE,MAAM,qCAAqC,CAAC;AACxE,OAAO,EAAE,mBAAmB,EAAE,MAAM,uCAAuC,CAAC;AAC5E,OAAO,EAAiB,eAAe,EAAE,MAAM,MAAM,CAAC;AAEtD,OAAO,EAAE,aAAa,EAAE,MAAM,UAAU,CAAC;AACzC,OAAO,EAAE,YAAY,EAAE,MAAM,UAAU,CAAC;AACxC,OAAO,EAAE,aAAa,EAAE,MAAM,4BAA4B,CAAC;AAC3D,OAAO,EAAE,YAAY,EAAE,MAAM,wBAAwB,CAAC;AAEtD,KAAK,SAAS,GAAG,YAAY,GAAG;IAC9B,mBAAmB,CAAC,EAAE,OAAO,CAAC,YAAY,CAAC,CAAC;IAC5C,iBAAiB,CAAC,EAAE,OAAO,CAAC,YAAY,CAAC,CAAC;IAC1C,aAAa,CAAC,EAAE,OAAO,CAAC,YAAY,CAAC,CAAC;CACvC,CAAC;AAEF,qBAAa,UAAW,SAAQ,SAAS,CAAC,UAAU,CAAC;IAevC,SAAS,CAAC,UAAU,EAAE,UAAU;IAd5C,eAAe,kBAAyB;IAExC,aAAa,EAAE,aAAa,CAAC;IAE7B,mBAAmB,EAAE,mBAAmB,CAAC;IAEzC,iBAAiB,EAAE,iBAAiB,CAAC;IAErC,aAAa,EAAE,aAAa,CAAC;IAE7B,MAAM,EAAE,SAAS,CAAM;IAEvB,OAAO,CAAC,EAAE,eAAe,CAAC;gBAEJ,UAAU,EAAE,UAAU;IAetC,MAAM,IAAI,OAAO,CAAC,IAAI,CAAC;YAIf,OAAO;IAoBf,4BAA4B,CAAC,MAAM,EAAE,SAAS,EAAE,OAAO,EAAE,eAAe,GAAG,OAAO,CAAC,IAAI,CAAC;IAqBxF,0BAA0B,CAAC,MAAM,EAAE,SAAS,EAAE,OAAO,EAAE,eAAe,GAAG,OAAO,CAAC,IAAI,CAAC;IAsBtF,sBAAsB,CAAC,MAAM,EAAE,SAAS,EAAE,OAAO,EAAE,eAAe,GAAG,OAAO,CAAC,IAAI,CAAC;YAqB1E,eAAe;IAU7B,OAAO,CAAC,qBAAqB;CAgB9B"}
}
declare module 'scaffoldly/scaffoldly/commands/index' {
  import { Mode, ProjectJson, ScaffoldlyConfig } from 'scaffoldly/config/index';
  import { PermissionAware } from 'scaffoldly/scaffoldly/commands/cd/index';
  import { PolicyDocument } from 'scaffoldly/scaffoldly/commands/cd/aws/iam';
  import { Preset } from 'scaffoldly/config/presets/index';
  import { PresetType } from 'scaffoldly/scaffoldly/commands/deploy';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  export type Cwd = string;
  export abstract class Command<T> implements PermissionAware {
      protected gitService: GitService;
      private _mode;
      private _config?;
      private _preset?;
      private _permissions;
      constructor(gitService: GitService, _mode: Mode);
      abstract handle(subcommand?: string): Promise<void>;
      get projectJson(): Promise<ProjectJson | undefined>;
      withPreset(preset?: PresetType): Promise<Command<T>>;
      withMode(mode?: Mode): Command<T>;
      get mode(): Mode;
      get preset(): Preset | undefined;
      get config(): Promise<ScaffoldlyConfig>;
      withPermissions(permissions: string[]): void;
      get permissions(): string[];
      get awsPolicyDocument(): PolicyDocument;
  }
  //# sourceMappingURL=index.d.ts.map
}
declare module 'scaffoldly/scaffoldly/commands/index.d.ts' {
  {"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/commands/index.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,IAAI,EAAE,WAAW,EAAE,gBAAgB,EAAE,MAAM,cAAc,CAAC;AAEnE,OAAO,EAAE,eAAe,EAAE,MAAM,MAAM,CAAC;AACvC,OAAO,EAAE,cAAc,EAAE,MAAM,cAAc,CAAC;AAC9C,OAAO,EAAE,MAAM,EAAE,MAAM,sBAAsB,CAAC;AAC9C,OAAO,EAAE,UAAU,EAAE,MAAM,UAAU,CAAC;AACtC,OAAO,EAAE,UAAU,EAAE,MAAM,UAAU,CAAC;AAQtC,MAAM,MAAM,GAAG,GAAG,MAAM,CAAC;AAEzB,8BAAsB,OAAO,CAAC,CAAC,CAAE,YAAW,eAAe;IAO7C,SAAS,CAAC,UAAU,EAAE,UAAU;IAAE,OAAO,CAAC,KAAK;IAN3D,OAAO,CAAC,OAAO,CAAC,CAAmB;IAEnC,OAAO,CAAC,OAAO,CAAC,CAAS;IAEzB,OAAO,CAAC,YAAY,CAAgB;gBAEd,UAAU,EAAE,UAAU,EAAU,KAAK,EAAE,IAAI;IAEjE,QAAQ,CAAC,MAAM,CAAC,UAAU,CAAC,EAAE,MAAM,GAAG,OAAO,CAAC,IAAI,CAAC;IAEnD,IAAI,WAAW,IAAI,OAAO,CAAC,WAAW,GAAG,SAAS,CAAC,CAkBlD;IAEK,UAAU,CAAC,MAAM,CAAC,EAAE,UAAU,GAAG,OAAO,CAAC,OAAO,CAAC,CAAC,CAAC,CAAC;IAQ1D,QAAQ,CAAC,IAAI,CAAC,EAAE,IAAI,GAAG,OAAO,CAAC,CAAC,CAAC;IAQjC,IAAI,IAAI,IAAI,IAAI,CAKf;IAED,IAAI,MAAM,IAAI,MAAM,GAAG,SAAS,CAE/B;IAED,IAAI,MAAM,IAAI,OAAO,CAAC,gBAAgB,CAAC,CA2BtC;IAED,eAAe,CAAC,WAAW,EAAE,MAAM,EAAE,GAAG,IAAI;IAI5C,IAAI,WAAW,IAAI,MAAM,EAAE,CAE1B;IAED,IAAI,iBAAiB,IAAI,cAAc,CAqBtC;CACF"}
}
declare module 'scaffoldly/scaffoldly/errors' {
  export const RETURN_CODE_NOT_LOGGED_IN = 10;
  export class ErrorWithReturnCode extends Error {
      readonly returnCode: number;
      constructor(returnCode: number, message: string);
  }
  //# sourceMappingURL=errors.d.ts.map
}
declare module 'scaffoldly/scaffoldly/errors.d.ts' {
  {"version":3,"file":"errors.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/errors.ts"],"names":[],"mappings":"AAAA,eAAO,MAAM,yBAAyB,KAAK,CAAC;AAE5C,qBAAa,mBAAoB,SAAQ,KAAK;aAChB,UAAU,EAAE,MAAM;gBAAlB,UAAU,EAAE,MAAM,EAAE,OAAO,EAAE,MAAM;CAGhE"}
}
declare module 'scaffoldly/scaffoldly/event' {
  import { ScaffoldlyConfig } from 'scaffoldly/config/index';
  export type AmplitudeEvent = {
      api_key: string;
      events: (Session | SessionEvent)[];
      options: Record<string, never>;
      client_upload_time: string;
  };
  export type Session = {
      device_id: string;
      session_id: number;
      time: number;
      platform: string;
      language: string;
      ip: string;
      insert_id: string;
      event_type: string;
      event_id: number;
      library: string;
      user_agent: string;
  };
  export type SessionEvent = Session & {
      event_type: '[Amplitude] Page Viewed';
      event_properties: {
          [key: string]: string;
      };
  };
  export class EventService {
      private platform;
      private version?;
      private session;
      private args?;
      private config?;
      private event$;
      constructor(platform: 'Cli' | 'Gha', version?: string | undefined, autoEnd?: boolean);
      get library(): string;
      get userAgent(): string;
      get sessionId(): number | undefined;
      withSessionId(sessionId?: number): EventService;
      withArgs(args: string[] | Record<string, string | undefined>): EventService;
      withConfig(config: ScaffoldlyConfig): EventService;
      end(): void;
      emit(payload?: Session | SessionEvent): void;
  }
  //# sourceMappingURL=event.d.ts.map
}
declare module 'scaffoldly/scaffoldly/event.d.ts' {
  {"version":3,"file":"event.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/event.ts"],"names":[],"mappings":"AAIA,OAAO,EAAqB,gBAAgB,EAAE,MAAM,WAAW,CAAC;AAKhE,MAAM,MAAM,cAAc,GAAG;IAC3B,OAAO,EAAE,MAAM,CAAC;IAChB,MAAM,EAAE,CAAC,OAAO,GAAG,YAAY,CAAC,EAAE,CAAC;IACnC,OAAO,EAAE,MAAM,CAAC,MAAM,EAAE,KAAK,CAAC,CAAC;IAC/B,kBAAkB,EAAE,MAAM,CAAC;CAC5B,CAAC;AAEF,MAAM,MAAM,OAAO,GAAG;IACpB,SAAS,EAAE,MAAM,CAAC;IAClB,UAAU,EAAE,MAAM,CAAC;IACnB,IAAI,EAAE,MAAM,CAAC;IACb,QAAQ,EAAE,MAAM,CAAC;IACjB,QAAQ,EAAE,MAAM,CAAC;IACjB,EAAE,EAAE,MAAM,CAAC;IACX,SAAS,EAAE,MAAM,CAAC;IAClB,UAAU,EAAE,MAAM,CAAC;IACnB,QAAQ,EAAE,MAAM,CAAC;IACjB,OAAO,EAAE,MAAM,CAAC;IAChB,UAAU,EAAE,MAAM,CAAC;CACpB,CAAC;AAEF,MAAM,MAAM,YAAY,GAAG,OAAO,GAAG;IACnC,UAAU,EAAE,yBAAyB,CAAC;IACtC,gBAAgB,EAAE;QAChB,CAAC,GAAG,EAAE,MAAM,GAAG,MAAM,CAAC;KACvB,CAAC;CACH,CAAC;AAsIF,qBAAa,YAAY;IASX,OAAO,CAAC,QAAQ;IAAiB,OAAO,CAAC,OAAO,CAAC;IAR7D,OAAO,CAAC,OAAO,CAAsB;IAErC,OAAO,CAAC,IAAI,CAAC,CAAgD;IAE7D,OAAO,CAAC,MAAM,CAAC,CAA6B;IAE5C,OAAO,CAAC,MAAM,CAA0C;gBAEpC,QAAQ,EAAE,KAAK,GAAG,KAAK,EAAU,OAAO,CAAC,EAAE,MAAM,YAAA,EAAE,OAAO,UAAO;IAerF,IAAI,OAAO,IAAI,MAAM,CAEpB;IAED,IAAI,SAAS,IAAI,MAAM,CAEtB;IAED,IAAI,SAAS,IAAI,MAAM,GAAG,SAAS,CAElC;IAEM,aAAa,CAAC,SAAS,CAAC,EAAE,MAAM,GAAG,YAAY;IAkB/C,QAAQ,CAAC,IAAI,EAAE,MAAM,EAAE,GAAG,MAAM,CAAC,MAAM,EAAE,MAAM,GAAG,SAAS,CAAC,GAAG,YAAY;IAM3E,UAAU,CAAC,MAAM,EAAE,gBAAgB,GAAG,YAAY;IAMlD,GAAG,IAAI,IAAI;IAYX,IAAI,CAAC,OAAO,CAAC,EAAE,OAAO,GAAG,YAAY,GAAG,IAAI;CAmBpD"}
}
declare module 'scaffoldly/scaffoldly/helpers/apiHelper' {
  import { STSClient } from '@aws-sdk/client-sts';
  import { Octokit } from 'octokit';
  import { EventService } from 'scaffoldly/scaffoldly/event';
  export class ApiHelper {
      private argv;
      private eventService;
      private dev;
      private octokit?;
      constructor(argv: string[], eventService: EventService);
      stsApi(): STSClient;
      githubApi(withToken: string): Octokit;
  }
  //# sourceMappingURL=apiHelper.d.ts.map
}
declare module 'scaffoldly/scaffoldly/helpers/apiHelper.d.ts' {
  {"version":3,"file":"apiHelper.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/helpers/apiHelper.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,SAAS,EAAE,MAAM,qBAAqB,CAAC;AAChD,OAAO,EAAE,OAAO,EAAE,MAAM,SAAS,CAAC;AAClC,OAAO,EAAE,YAAY,EAAE,MAAM,UAAU,CAAC;AAExC,qBAAa,SAAS;IAKR,OAAO,CAAC,IAAI;IAAY,OAAO,CAAC,YAAY;IAJxD,OAAO,CAAC,GAAG,CAAS;IAEpB,OAAO,CAAC,OAAO,CAAC,CAAU;gBAEN,IAAI,EAAE,MAAM,EAAE,EAAU,YAAY,EAAE,YAAY;IAWtE,MAAM,IAAI,SAAS;IAInB,SAAS,CAAC,SAAS,EAAE,MAAM,GAAG,OAAO;CAYtC"}
}
declare module 'scaffoldly/scaffoldly/helpers/awsHelper' {
  import { ApiHelper } from 'scaffoldly/scaffoldly/helpers/apiHelper';
  export class AwsHelper {
      private apiHelper;
      constructor(apiHelper: ApiHelper);
      currentIdentity(): Promise<string | undefined>;
  }
  //# sourceMappingURL=awsHelper.d.ts.map
}
declare module 'scaffoldly/scaffoldly/helpers/awsHelper.d.ts' {
  {"version":3,"file":"awsHelper.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/helpers/awsHelper.ts"],"names":[],"mappings":"AAEA,OAAO,EAAE,SAAS,EAAE,MAAM,aAAa,CAAC;AAExC,qBAAa,SAAS;IACR,OAAO,CAAC,SAAS;gBAAT,SAAS,EAAE,SAAS;IAElC,eAAe,IAAI,OAAO,CAAC,MAAM,GAAG,SAAS,CAAC;CAUrD"}
}
declare module 'scaffoldly/scaffoldly/helpers/githubHelper' {
  import { Scms } from 'scaffoldly/scaffoldly/stores/scms';
  import { ApiHelper } from 'scaffoldly/scaffoldly/helpers/apiHelper';
  import { MessagesHelper } from 'scaffoldly/scaffoldly/helpers/messagesHelper';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  export class GithubHelper {
      private apiHelper;
      private messagesHelper;
      private gitService;
      scms: Scms;
      constructor(apiHelper: ApiHelper, messagesHelper: MessagesHelper, gitService: GitService);
      promptLogin(withToken?: string): Promise<void>;
  }
  //# sourceMappingURL=githubHelper.d.ts.map
}
declare module 'scaffoldly/scaffoldly/helpers/githubHelper.d.ts' {
  {"version":3,"file":"githubHelper.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/helpers/githubHelper.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,IAAI,EAAE,MAAM,gBAAgB,CAAC;AACtC,OAAO,EAAE,SAAS,EAAE,MAAM,aAAa,CAAC;AACxC,OAAO,EAAE,cAAc,EAAE,MAAM,kBAAkB,CAAC;AAElD,OAAO,EAAE,UAAU,EAAE,MAAM,oBAAoB,CAAC;AAEhD,qBAAa,YAAY;IAIrB,OAAO,CAAC,SAAS;IACjB,OAAO,CAAC,cAAc;IACtB,OAAO,CAAC,UAAU;IALpB,IAAI,EAAE,IAAI,CAAC;gBAGD,SAAS,EAAE,SAAS,EACpB,cAAc,EAAE,cAAc,EAC9B,UAAU,EAAE,UAAU;IAK1B,WAAW,CAAC,SAAS,CAAC,EAAE,MAAM,GAAG,OAAO,CAAC,IAAI,CAAC;CAOrD"}
}
declare module 'scaffoldly/scaffoldly/helpers/messagesHelper' {
  export class MessagesHelper {
      processName: string;
      _headless: boolean;
      set headless(value: boolean);
      get headless(): boolean;
      constructor(argv: string[]);
      status(str?: string): void;
      write(str: string): void;
  }
  //# sourceMappingURL=messagesHelper.d.ts.map
}
declare module 'scaffoldly/scaffoldly/helpers/messagesHelper.d.ts' {
  {"version":3,"file":"messagesHelper.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/helpers/messagesHelper.ts"],"names":[],"mappings":"AAEA,qBAAa,cAAc;IACzB,WAAW,SAAgB;IAE3B,SAAS,UAAS;IAElB,IAAI,QAAQ,CAAC,KAAK,EAAE,OAAO,EAE1B;IAED,IAAI,QAAQ,IAAI,OAAO,CAEtB;gBAEW,IAAI,EAAE,MAAM,EAAE;IAOnB,MAAM,CAAC,GAAG,CAAC,EAAE,MAAM,GAAG,IAAI;IAQ1B,KAAK,CAAC,GAAG,EAAE,MAAM,GAAG,IAAI;CAQhC"}
}
declare module 'scaffoldly/scaffoldly/messages' {
  export const NO_GITHUB_CLIENT = "There was an unknown issue loading GitHub client libraries";
  export const NOT_LOGGED_IN: (processName: string) => string;
  export const ERROR_LOADING_FILE: (file: string, error: Error) => string;
  export const ERROR_LOGGING_IN: (message: string) => string;
  //# sourceMappingURL=messages.d.ts.map
}
declare module 'scaffoldly/scaffoldly/messages.d.ts' {
  {"version":3,"file":"messages.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/messages.ts"],"names":[],"mappings":"AAAA,eAAO,MAAM,gBAAgB,+DAA+D,CAAC;AAC7F,eAAO,MAAM,aAAa,gBAAiB,MAAM,KAAG,MACuE,CAAC;AAC5H,eAAO,MAAM,kBAAkB,SAAU,MAAM,SAAS,KAAK,KAAG,MACd,CAAC;AACnD,eAAO,MAAM,gBAAgB,YAAa,MAAM,KAAG,MAAwC,CAAC"}
}
declare module 'scaffoldly/scaffoldly/stores/scms' {
  import { Octokit } from 'octokit';
  import { ApiHelper } from 'scaffoldly/scaffoldly/helpers/apiHelper';
  import { MessagesHelper } from 'scaffoldly/scaffoldly/helpers/messagesHelper';
  import { GitService } from 'scaffoldly/scaffoldly/commands/cd/git/index';
  export type Scm = 'github';
  export type ScmClients = {
      github?: Octokit;
  };
  export class NoTokenError extends Error {
      constructor(message?: string);
  }
  export class Scms {
      private apiHelper;
      private messagesHelper;
      private gitService;
      constructor(apiHelper: ApiHelper, messagesHelper: MessagesHelper, gitService: GitService);
      private getTokenFromEnv;
      private getTokenFromGhCli;
      getGithubToken(withToken?: string): Promise<string | undefined>;
      private getOctokit;
      getLogin(withToken?: string): Promise<string>;
  }
  //# sourceMappingURL=scms.d.ts.map
}
declare module 'scaffoldly/scaffoldly/stores/scms.d.ts' {
  {"version":3,"file":"scms.d.ts","sourceRoot":"","sources":["../../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/stores/scms.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,OAAO,EAAE,MAAM,SAAS,CAAC;AAKlC,OAAO,EAAE,SAAS,EAAE,MAAM,sBAAsB,CAAC;AACjD,OAAO,EAAE,cAAc,EAAE,MAAM,2BAA2B,CAAC;AAE3D,OAAO,EAAE,UAAU,EAAU,MAAM,oBAAoB,CAAC;AAExD,MAAM,MAAM,GAAG,GAAG,QAAQ,CAAC;AAE3B,MAAM,MAAM,UAAU,GAAG;IACvB,MAAM,CAAC,EAAE,OAAO,CAAC;CAClB,CAAC;AAEF,qBAAa,YAAa,SAAQ,KAAK;gBACzB,OAAO,CAAC,EAAE,MAAM;CAG7B;AAMD,qBAAa,IAAI;IAEb,OAAO,CAAC,SAAS;IACjB,OAAO,CAAC,cAAc;IACtB,OAAO,CAAC,UAAU;gBAFV,SAAS,EAAE,SAAS,EACpB,cAAc,EAAE,cAAc,EAC9B,UAAU,EAAE,UAAU;IAGhC,OAAO,CAAC,eAAe;IAIvB,OAAO,CAAC,iBAAiB;IA8BZ,cAAc,CAAC,SAAS,CAAC,EAAE,MAAM,GAAG,OAAO,CAAC,MAAM,GAAG,SAAS,CAAC;YAwB9D,UAAU;IAIX,QAAQ,CAAC,SAAS,CAAC,EAAE,MAAM,GAAG,OAAO,CAAC,MAAM,CAAC;CA+B3D"}
}
declare module 'scaffoldly/scaffoldly/ui' {
  import inquirer from 'inquirer';
  export const isInteractive: () => boolean;
  export const isHeadless: () => boolean;
  export const isDebug: () => boolean;
  export const isLocalDeps: () => boolean;
  export const hasOutput: () => boolean;
  export class BottomBar {
      private stream;
      headless: boolean;
      hasOutput: boolean;
      bottomBar: inquirer.ui.BottomBar;
      interval?: NodeJS.Timeout;
      subtext?: string;
      constructor(stream: NodeJS.WriteStream);
      updateBottomBarSubtext(text: string): void;
      updateBottomBar(text: string): void;
  }
  //# sourceMappingURL=ui.d.ts.map
}
declare module 'scaffoldly/scaffoldly/ui.d.ts' {
  {"version":3,"file":"ui.d.ts","sourceRoot":"","sources":["../../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly/ui.ts"],"names":[],"mappings":"AAAA,OAAO,QAAQ,MAAM,UAAU,CAAC;AAEhC,eAAO,MAAM,aAAa,QAAO,OAEhC,CAAC;AAEF,eAAO,MAAM,UAAU,QAAO,OAE7B,CAAC;AAEF,eAAO,MAAM,OAAO,QAAO,OAE1B,CAAC;AAEF,eAAO,MAAM,WAAW,QAAO,OAE9B,CAAC;AAEF,eAAO,MAAM,SAAS,QAAO,OAE5B,CAAC;AAMF,qBAAa,SAAS;IAWR,OAAO,CAAC,MAAM;IAV1B,QAAQ,UAAS;IAEjB,SAAS,UAAS;IAElB,SAAS,EAAE,QAAQ,CAAC,EAAE,CAAC,SAAS,CAAC;IAEjC,QAAQ,CAAC,EAAE,MAAM,CAAC,OAAO,CAAC;IAE1B,OAAO,CAAC,EAAE,MAAM,CAAC;gBAEG,MAAM,EAAE,MAAM,CAAC,WAAW;IAMvC,sBAAsB,CAAC,IAAI,EAAE,MAAM,GAAG,IAAI;IAa1C,eAAe,CAAC,IAAI,EAAE,MAAM,GAAG,IAAI;CA8C3C"}
}
declare module 'scaffoldly/scaffoldly' {
  export const outputStream: (NodeJS.WriteStream & {
      fd: 1;
  }) | (NodeJS.WriteStream & {
      fd: 2;
  });
  export const customConsole: Console;
  export const run: (version?: string) => Promise<void>;
  //# sourceMappingURL=scaffoldly.d.ts.map
}
declare module 'scaffoldly/scaffoldly.d.ts' {
  {"version":3,"file":"scaffoldly.d.ts","sourceRoot":"","sources":["../../../home/runner/work/scaffoldly/scaffoldly/src/scaffoldly.ts"],"names":[],"mappings":"AAQA,eAAO,MAAM,YAAY;;;;EAAiD,CAAC;AAC3E,eAAO,MAAM,aAAa,SAA4C,CAAC;AAUvE,eAAO,MAAM,GAAG,aAAoB,MAAM,KAAG,OAAO,CAAC,IAAI,CAyBxD,CAAC"}
}
declare module 'scaffoldly' {
  import main = require('scaffoldly/src/index');
  export = main;
}