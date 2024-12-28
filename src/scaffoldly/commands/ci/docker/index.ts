import Docker, { AuthConfig, ImageBuildOptions } from 'dockerode';
import tar from 'tar-fs';
import { existsSync, readFileSync } from 'fs';
import {
  Script,
  ScaffoldlyConfig,
  DEFAULT_SRC_ROOT,
  Commands,
  Shell,
  ServiceName,
} from '../../../../config';
import {
  join,
  // relative,
  sep,
} from 'path';
import { ui } from '../../../command';
import { isDebug } from '../../../ui';
import { Platform } from '../../cd/docker';
import { PackageService } from './packages';
import { decodeTrace } from './protobuf/moby';
import { GitService } from '../../cd/git';

export type BuildInfo = {
  imageName?: string;
  imageTag?: string;
  imageSize?: number;
  entrypoint?: string[];
};
export type PushInfo = { imageName?: string; imageDigest?: string };

const BASE = 'base';

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
  prerequisite?: boolean;
};

export type RunCommand = {
  workdir?: string;
  cmds: string[];
  prerequisite: boolean;
};

type DockerStage = { [key: string]: DockerFileSpec | undefined };

type DockerStages = {
  cwd: string;
  bases: DockerStage;
  builds: DockerStage;
  packages: DockerStage;
  runtime: DockerFileSpec;
};

type DockerFileSpec = {
  // bases?: DockerFileSpec[];
  from: string;
  as: string;
  rootdir: string;
  workdir?: string;
  copy?: Copy[];
  env?: { [key: string]: string | undefined };
  run?: RunCommand[];
  paths?: string[];
  cmd?: Commands;
  shell?: Shell;
  user?: string;
};

type DockerEvent =
  | ErrorEvent
  | StreamEvent
  | StatusEvent
  | AuxEvent<AuxDigestEvent>
  | AuxEvent<string>;

type ErrorEvent = {
  error?: string;
  errorDetail?: {
    message?: string;
  };
};

type StreamEvent = {
  stream?: string;
};

type StatusEvent = {
  status?: string;
  progressDetail?: {
    current?: number;
    total?: number;
  };
  progress?: string;
  id?: string;
};

type AuxDigestEvent = {
  Digest?: string;
};

type AuxEvent<T extends AuxDigestEvent | string> = {
  progressDetail?: unknown;
  id?: string;
  aux?: T;
};

const splitPath = (path: string): [string, string] => {
  const parts = path.split(sep);
  return [parts.slice(0, -1).join(sep), parts.pop() as string];
};

export class DockerService {
  docker: Docker;

  private imageName?: string;

  private imageTag?: string;

  private imageDigest?: string;

  private imageInfo?: Docker.ImageInspectInfo;

  private _platform?: Platform;

  private _withIgnoredFiles?: string[];

  constructor(private gitService: GitService) {
    this.docker = new Docker({ version: 'v1.45' });
  }

  withIgnoredFiles(files: string[]): DockerService {
    this._withIgnoredFiles = files;
    return this;
  }

  get platform(): Platform {
    if (!this._platform) {
      throw new Error('Platform not set');
    }
    return this._platform;
  }

  private handleDockerEvent(type: 'Pull' | 'Build' | 'Push', event: DockerEvent) {
    // console.error('!!! event', event);
    if (
      'id' in event &&
      event.id === 'moby.buildkit.trace' &&
      'aux' in event &&
      typeof event.aux === 'string'
    ) {
      const trace = decodeTrace(event.aux);
      if (trace?.code === 2) {
        ui.updateBottomBar('');
        console.warn(`\n${trace.message}`);
      }
    }
    if ('stream' in event && typeof event.stream === 'string') {
      if (isDebug()) {
        ui.updateBottomBarSubtext(event.stream);
      } else if (event.stream.startsWith('Step ')) {
        ui.updateBottomBarSubtext(event.stream);
      }
    }
    if ('status' in event && typeof event.status === 'string') {
      ui.updateBottomBarSubtext(event.status);
    }

    if ('error' in event) {
      throw new Error(
        `Image ${type} Failed: ${event.error || event.errorDetail?.message || 'Unknown Error'}`,
      );
    }
  }

  async describeBuild(config: ScaffoldlyConfig): Promise<BuildInfo> {
    this._platform = await this.getPlatform(config.runtimes, 'match-host');
    // TODO: Dynamic entrypoint
    // DEVNOTE: Entrypoint is set during prebuild so it must be known before deploy
    return {
      imageName: this.imageName,
      imageTag: this.imageTag,
      imageSize: this.imageInfo?.Size,
      entrypoint: ['.entrypoint'],
    };
  }

  async generateDockerfile(
    cwd: string,
    config: ScaffoldlyConfig,
    env?: Record<string, string>,
  ): Promise<{ dockerfile: string; stages: DockerStages }> {
    this._platform = await this.getPlatform(config.runtimes, 'match-host');
    const stages = await this.createStages(cwd, config, env);

    if (isDebug()) {
      ui.updateBottomBarSubtext(`Stages: ${JSON.stringify(stages)}`);
    }

    const dockerfile = this.renderStages(stages);

    return { dockerfile, stages };
  }

  async build(
    config: ScaffoldlyConfig,
    mode: Script,
    repositoryUri?: string,
    env?: Record<string, string>,
  ): Promise<void> {
    const tag = config.id ? `${config.version}-${config.id}` : config.version;

    const imageTag = `${config.name}:${tag}`;
    const imageName = repositoryUri ? `${repositoryUri}:${tag}` : imageTag;

    const baseDir = await this.gitService.baseDir;
    const workDir = await this.gitService.workDir;

    // const dockerfile = this.renderSpec(spec);
    const { dockerfile, stages } = await this.generateDockerfile(workDir, config, env);

    ui.updateBottomBarSubtext('Creating tarball');
    const stream = tar.pack(baseDir, {
      // Disabled filter, super buggy with symlinked files
      // IIRC I did this for local development speedup
      // filter: (path) => {
      //   const relativePath = relative(baseDir, path);
      //   const filter = !config.ignoreFilter(relativePath);
      //   return filter;
      // },
    });

    stream.entry(
      {
        name: `Dockerfile.${mode}`,
      },
      dockerfile,
      () => {},
    );

    stages.runtime.copy
      ?.filter((c) => c.resolve)
      .forEach((c) => {
        // This will remove the symlink and add the actual file
        const content = readFileSync(join(workDir, c.src));
        stream.entry(
          {
            name: c.dest,
            mode: c.mode,
          },
          content,
          () => {},
        );
      });

    const { runtime } = config;
    if (!runtime) {
      throw new Error('Missing runtime');
    }

    // TODO: Multi-platform
    ui.updateBottomBarSubtext('Building Image');
    const buildStream = await this.docker.buildImage(stream, {
      dockerfile: `Dockerfile.${mode}`,
      t: imageName,
      q: true,
      rm: true,
      forcerm: true,
      platform: this.platform,
      version: '2',
    } as ImageBuildOptions);

    await new Promise<DockerEvent[]>((resolve, reject) => {
      this.docker.modem.followProgress(
        buildStream,
        (err, res) => (err ? reject(err) : resolve(res)),
        (event) => {
          try {
            this.handleDockerEvent('Build', event);
          } catch (e) {
            reject(e);
          }
        },
      );
    });

    const image = this.docker.getImage(imageName);
    this.imageInfo = await image.inspect();

    this.imageName = imageName;
    this.imageTag = imageTag;

    // TODO: Return SHA
  }

  async createStages(
    cwd: string,
    config: ScaffoldlyConfig,
    env?: Record<string, string>,
  ): Promise<DockerStages> {
    ui.updateBottomBarSubtext('Creating Install Stages');
    const bases: DockerStage = await this.createStage(config, 'install', {});
    ui.updateBottomBarSubtext('Creating Build Stages');
    const builds: DockerStage = await this.createStage(config, 'build', bases, env); // Include env in build stage
    ui.updateBottomBarSubtext('Creating Package Stages');
    const packages: DockerStage = await this.createStage(config, 'package', builds);

    ui.updateBottomBarSubtext('Creating Runtime Stage');
    const runtime = await this.createSpec(config, 'start', BASE, packages);

    if (!runtime) {
      throw new Error('Failed to create runtime spec');
    }

    return { cwd, bases, builds, packages, runtime };
  }

  async createStage(
    config: ScaffoldlyConfig,
    mode: Script,
    fromStages: DockerStage,
    env?: Record<string, string>,
  ): Promise<DockerStage> {
    let bases: DockerStage = {};

    const spec = await this.createSpec(config, mode, BASE, fromStages, env);

    if (spec) {
      bases[spec.as] = spec;
    }

    const { services } = config;

    bases = await services.reduce(async (accP, service) => {
      const acc = await accP;

      const serviceSpec = await this.createSpec(service, mode, service.name, fromStages, env);
      if (!serviceSpec) {
        return acc;
      }

      return {
        ...acc,
        [serviceSpec.as]: serviceSpec,
      };
    }, Promise.resolve(bases));

    return bases;
  }

  async createSpec(
    config: ScaffoldlyConfig,
    mode: Script,
    name: ServiceName,
    fromStages: DockerStage,
    env?: Record<string, string>,
  ): Promise<DockerFileSpec | undefined> {
    const packageService = new PackageService(this, config);

    const { taskdir, rootdir, shell, runtime, src, files, scripts, bin, user } = config;

    const spec: DockerFileSpec = {
      from: `install-${name}`,
      as: `${mode}-${name}`,
      rootdir,
      workdir: taskdir,
      shell: shell,
      cmd: undefined,
      copy: await packageService.files,
      paths: [],
      env: {
        ...packageService.env,
        ...(env || {}),
      },
      run: [],
      user,
    };

    if (mode === 'install') {
      spec.from = runtime;

      const runCommands = await packageService.commands;

      runCommands.push({
        cmds: scripts.prepare ? [scripts.prepare] : [],
        prerequisite: true,
        workdir: join(taskdir, src),
      });

      // runCommands.push({
      //   cmds: scripts.install ? [scripts.install] : [],
      //   prerequisite: false,
      //   // workdir: src !== DEFAULT_SRC_ROOT ? src : DEFAULT_SRC_ROOT, //FOO
      //   workdir: taskdir,
      // });

      // if (scripts.install) {
      //   const copy: Copy[] = [{ src, dest: src }];
      //   // if (src !== DEFAULT_SRC_ROOT) {
      //   //   files.forEach((file) => {
      //   //     const [from, f] = file.split(':');
      //   //     if (from && f) {
      //   //       copy.push({
      //   //         from: `${mode}-${from}`,
      //   //         src: join(src, f), // TODO figure out ".."
      //   //         dest: join(src, f),
      //   //       });
      //   //       return;
      //   //     }
      //   //     copy.push({ src: file, dest: file });
      //   //   });
      //   // }
      //   spec.copy = copy;
      // }

      spec.run = runCommands;

      return spec;
    }

    const paths = await packageService.paths;

    if (mode === 'build') {
      // const fromStage = fromStages[`install-${name}`];

      spec.run = [
        {
          cmds: scripts.install ? [scripts.install] : [],
          prerequisite: false,
          workdir: join(taskdir, src),
        },
        {
          cmds: scripts.build ? [scripts.build] : [],
          prerequisite: false,
          workdir: join(taskdir, src),
        },
      ];

      const copy: Copy[] = [{ src: DEFAULT_SRC_ROOT, dest: taskdir }];
      // if (src !== DEFAULT_SRC_ROOT) {
      //   files.forEach((file) => {
      //     const [from, f] = file.split(':');
      //     if (from && f) {
      //       copy.push({
      //         from: `${mode}-${from}`,
      //         src: join(src, f),
      //         dest: join(src, f),
      //       });
      //       return;
      //     }
      //     copy.push({ from: fromStage?.as, src: file, dest: file });
      //   });
      // }

      spec.copy = copy;
      spec.paths = paths;

      return spec;
    }

    if (mode === 'package') {
      const fromStage = fromStages[`build-${name}`];

      const copy = files.map((file) => {
        const [from, f] = file.split(':');
        if (from && f) {
          const cp: Copy = {
            from: `${mode}-${from}`,
            src: join(src, f),
            dest: join(src, f),
          };
          return cp;
        }
        const cp: Copy = {
          from: fromStage?.as,
          src: join(src, file),
          dest: join(src, file),
        };
        return cp;
      });

      Object.entries(bin).forEach(([, nameAndPath]) => {
        if (!nameAndPath) return;

        let [fromName, path] = nameAndPath.split(':');
        if (path) {
          // TODO: handle ':' in nameAndPath
          return;
        }

        path = fromName;
        fromName = 'base';

        const binStage = fromStages[`build-${fromName.toLowerCase()}`];
        if (!binStage) return;

        const [binDir] = splitPath(path);
        copy.push({
          from: binStage.as,
          src: join(src, binDir),
          dest: join(src, binDir, sep),
          binDir: true,
        });
      });

      if (name !== 'base') {
        (this._withIgnoredFiles || []).forEach((file) => {
          copy.push({
            from: fromStage?.as,
            src: `${file}*`,
            dest: file,
            resolve: false,
            noGlob: true,
          });
        });
      }

      spec.copy = copy;
      spec.paths = paths;

      return spec;
    }

    if (mode === 'start') {
      spec.as = `runtime`;
      spec.cmd = config.serveCommands;

      const copy = Object.keys(fromStages)
        .reverse() // Earlier stages get higher precedence
        .map((key) => {
          const fromStage = fromStages[key];
          const copies = fromStage?.copy || [];
          return copies
            .filter((c) => !c.binDir)
            .map((c) => {
              const cp: Copy = { ...c, from: key, noGlob: true };
              return cp;
            });
        })
        .flat();

      Object.entries(bin).forEach(([script, nameAndPath]) => {
        if (!nameAndPath) return;

        let [fromName, path] = nameAndPath.split(':');
        if (!fromName) return;

        if (!path) {
          path = fromName;
          fromName = 'base';
        }

        const binStage = fromStages[`package-${fromName.toLowerCase()}`];
        if (!binStage) return;

        const scriptPath = join(src, script);
        const [binDir, binFile] = splitPath(path);

        // paths.push(join(workdir, src, binDir));
        copy.push({
          from: binStage.as,
          src: join(src, binDir),
          dest: join(src, sep),
          resolve: false,
          noGlob: true,
        });
        copy.push({
          from: binStage.as,
          src: join(src, binDir, binFile),
          dest: scriptPath,
          resolve: false,
          noGlob: true,
        });
      });

      copy.push(packageService.entrypoint);

      spec.copy = copy;
      spec.paths = [
        ...Object.values(fromStages)
          .map((fromStage) => fromStage?.paths || [])
          .flat(),
        ...paths,
      ];

      return spec;
    }

    return undefined;
  }

  renderStages = (stages: DockerStages): string => {
    const lines = [];

    const { cwd, bases, builds, packages, runtime } = stages;

    Object.values(bases).forEach((spec, ix) => {
      ui.updateBottomBarSubtext(`Rendering ${spec?.as} stage`);
      lines.push(this.renderSpec('install', cwd, spec, ix));
      lines.push('');
    });

    Object.values(builds).forEach((spec, ix) => {
      ui.updateBottomBarSubtext(`Rendering ${spec?.as} stage`);
      lines.push(this.renderSpec('build', cwd, spec, ix));
      lines.push('');
    });

    Object.values(packages).forEach((spec, ix) => {
      ui.updateBottomBarSubtext(`Rendering ${spec?.as} stage`);
      lines.push(this.renderSpec('package', cwd, spec, ix));
      lines.push('');
    });

    ui.updateBottomBarSubtext(`Rendering ${runtime.as} stage`);
    lines.push(this.renderSpec('start', cwd, runtime, 0));

    return lines.join('\n');
  };

  renderSpec = (
    mode: Script,
    cwd: string,
    spec: DockerFileSpec | undefined,
    ix: number,
  ): string => {
    const lines = [];
    let COPY = 'COPY';

    if (!spec) {
      if (isDebug()) {
        return `# ${mode} stage at ${ix} skipped`;
      }
      return '';
    }

    // if (spec.bases) {
    //   for (const base of spec.bases) {
    //     lines.push(this.render(base, mode));
    //     lines.push('');
    //   }
    // }

    const { copy, rootdir, workdir, env = {}, run, paths = [], cmd, shell, user } = spec;

    const from = spec.as ? `${spec.from} AS ${spec.as}` : spec.from;

    lines.push(`FROM ${from}`);
    if (workdir) lines.push(`WORKDIR ${workdir}`);

    for (const path of new Set(paths)) {
      lines.push(`ENV PATH="${path}:$PATH"`);
    }

    for (const [key, value] of Object.entries(env)) {
      if (value) {
        lines.push(`ENV ${key}="${value}"`);
      }
    }

    const prereqFiles = copy?.filter((c) => !!c.prerequisite);
    if (prereqFiles) {
      prereqFiles.forEach((c) => {
        lines.push(`COPY ${c.src} ${c.dest}`);
      });
    }

    const prereqRuns = run?.filter((r) => r.prerequisite && r.cmds.length);
    if (prereqRuns) {
      prereqRuns.forEach((r) => {
        if (r.workdir) {
          r.cmds.unshift(`cd ${r.workdir}`);
        }

        lines.push(`RUN ${r.cmds.join(' && ')}`);
      });
    }

    if (user) {
      lines.push(`USER ${user}`);
      COPY = `${COPY} --chown=${user}`;
    }

    const copyLines = new Set<string>();
    if (copy) {
      copy
        .filter((c) => !c.from && !c.prerequisite)
        .forEach((c) => {
          if (c.resolve && workdir) {
            copyLines.add(`${COPY} ${c.dest}* ${join(workdir, c.dest)}`);
            return;
          }

          if (c.src === DEFAULT_SRC_ROOT) {
            copyLines.add(`${COPY} ${c.src} ${rootdir}${sep}`);
            return;
          }

          const exists = existsSync(join(cwd, c.src));
          if (exists && workdir) {
            copyLines.add(`${COPY} ${c.src} ${join(workdir, c.dest)}`);
          }
        });

      copy
        .filter((c) => !!c.from && !c.prerequisite)
        .forEach((c) => {
          let { src } = c;
          if (src === DEFAULT_SRC_ROOT && workdir) {
            src = workdir;
          }

          if (c.noGlob && workdir) {
            if (c.absolute) {
              copyLines.add(`${COPY} --from=${c.from} ${src} ${join(workdir, c.dest)}`);
              return;
            }
            copyLines.add(
              `${COPY} --from=${c.from} ${join(workdir, src)} ${join(workdir, c.dest)}`,
            );
            return;
          }

          const exists = existsSync(join(cwd, src));
          if (workdir) {
            let source = join(workdir, src);
            if (!exists) {
              source = `${source}*`;
            }
            copyLines.add(`${COPY} --from=${c.from} ${source} ${join(workdir, c.dest)}`);
          }
        });
    }
    lines.push(...copyLines);

    if (run) {
      const runs = run.filter((r) => !r.prerequisite && r.cmds.length);

      runs.forEach((r) => {
        if (shell === 'direnv') {
          lines.push(`RUN direnv allow`);
          // TODO: infer default /bin/sh command from base image
          // TODO: does entrypoint need to be added to lambda runtime?
          lines.push(`SHELL [ "direnv", "exec", "${workdir}", "/bin/sh", "-c" ]`);
        }

        if (r.workdir) {
          r.cmds.unshift(`cd ${r.workdir}`);
        }

        lines.push(`RUN ${r.cmds.join(' && ')}`);
      });
    }

    if (cmd) {
      lines.push(`CMD [ "${cmd.toString({})}" ]`);
    }

    const dockerfile = lines.join('\n');

    return dockerfile;
  };

  public async describePush(config: ScaffoldlyConfig): Promise<PushInfo> {
    if (!this._platform) {
      this._platform = await this.getPlatform(config.runtimes, 'match-host');
    }
    return { imageName: this.imageName, imageDigest: this.imageDigest };
  }

  public async push(
    config: ScaffoldlyConfig,
    repositoryUri?: string,
    imageName?: string,
    authConfig?: AuthConfig,
  ): Promise<{ imageDigest?: string }> {
    if (!imageName) {
      // Image name isn't set yet, likely because we're in predeploy
      // Grab runtimes[0] and set that as the image name
      const image = this.docker.getImage(config.runtimes[0]);
      await image.tag({ repo: repositoryUri || config.name, tag: 'predeploy' });
      imageName = `${repositoryUri || config.name}:predeploy`;
    }

    const image = this.docker.getImage(imageName);

    const pushStream = await image.push({ authconfig: authConfig });

    ui.updateBottomBarSubtext('Pushing Image');
    const events = await new Promise<DockerEvent[]>((resolve, reject) => {
      this.docker.modem.followProgress(
        pushStream,
        (err, res) => (err ? reject(err) : resolve(res)),
        (event) => {
          try {
            this.handleDockerEvent('Push', event);
          } catch (e) {
            reject(e);
          }
        },
      );
    });

    const event = events.find(
      (evt) => 'aux' in evt && !!evt.aux && typeof evt.aux !== 'string' && 'Digest' in evt.aux,
    ) as AuxEvent<AuxDigestEvent>;

    const imageDigest = event?.aux?.Digest;
    this.imageDigest = event?.aux?.Digest;

    if (!imageDigest) {
      throw new Error('Failed to get image digest');
    }

    this.imageInfo = await image.inspect();

    return { imageDigest };
  }

  private async getImages(
    runtimes: string[],
    architecture: Architecture,
  ): Promise<Docker.ImageInspectInfo[]> {
    const images = await Promise.all(
      runtimes.map(async (runtime) => {
        const image = await this.getImage(runtime, architecture);
        return image;
      }),
    );

    return images.filter((image) => !!image) as Docker.ImageInspectInfo[];
  }

  private async getImage(
    runtime: string,
    architecture: Architecture,
    pull = true,
  ): Promise<Docker.ImageInspectInfo | undefined> {
    if (pull) {
      await this.pullImage(runtime, architecture);
    }

    const image = this.docker.getImage(runtime);

    let inspected: Docker.ImageInspectInfo | undefined = undefined;

    try {
      inspected = await image.inspect();
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }
      if ('statusCode' in e && e.statusCode === 404) {
        await this.pullImage(runtime, architecture);
      }
    }

    if (!pull && !inspected) {
      inspected = await this.getImage(runtime, architecture, false);
    }

    return inspected;
  }

  private async pullImage(runtime: string, architecture: Architecture): Promise<void> {
    let platform: Platform | undefined = undefined;

    switch (architecture) {
      case 'x86_64':
        platform = 'linux/amd64';
        break;
      case 'arm64':
        platform = 'linux/arm64';
        break;
      case 'match-host':
        platform = undefined;
        break;
    }

    ui.updateBottomBarSubtext(`Pulling image for ${runtime} with architecture ${architecture}`);

    // Ensure docker is awake
    await Promise.race([
      this.docker.ping(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Please ensure docker is online and not in power svaing mode.')),
          5000,
        ),
      ),
    ]);

    const pullStream = await this.docker.pull(runtime, { platform });

    try {
      await new Promise<DockerEvent[]>((resolve, reject) => {
        this.docker.modem.followProgress(
          pullStream,
          (err, res) => (err ? reject(err) : resolve(res)),
          (event) => {
            try {
              this.handleDockerEvent('Pull', event);
            } catch (e) {
              reject(e);
            }
          },
        );
      });
    } catch (e) {
      throw new Error(`Unable to pull image for ${runtime}`, { cause: e });
    }

    return;
  }

  private async getPlatform(runtimes: string[], architecture: Architecture): Promise<Platform> {
    const images = await this.getImages(runtimes, architecture);

    if (!images || !images.length) {
      throw new Error(`Failed to get images for ${runtimes}`);
    }

    const primaryArchitecture = images[0].Architecture;

    if (images.some((image) => image.Architecture !== primaryArchitecture)) {
      // TODO: this could theoretically be ok and we could just throw a warning
      //       but it really depends on what the developer builds in the subservices
      throw new Error(
        `All runtimes (${runtimes}) must have the same architecture: ${primaryArchitecture}`,
      );
    }

    switch (primaryArchitecture) {
      case 'amd64':
        return 'linux/amd64';
      case 'arm64':
        return 'linux/arm64';
      default:
        throw new Error(`Unsupported architecture: ${primaryArchitecture}`);
    }
  }

  public async checkBin<T extends string[]>(
    runtime: string,
    bins: [...T],
    platform: Platform,
  ): Promise<T[number] | undefined> {
    if (!bins || !bins.length) {
      return undefined;
    }

    // DEVNOTE: Using "match-host" here b/c for some reason createContainer isn't respecting the platform arg
    const image = await this.getImage(runtime, 'match-host');

    if (!image) {
      throw new Error(`Failed to get image for ${runtime}`);
    }

    if (!image.RepoDigests || !image.RepoDigests.length) {
      throw new Error(`Failed to get image digest for ${runtime}`);
    }

    let bin = bins.pop();

    const container = await this.docker.createContainer({
      Image: image.RepoDigests[0],
      Cmd: [`command -v ${bin}`], // TODO: check OS to determine command checker
      Tty: false,
      Entrypoint: ['/bin/sh', '-c'], // TODO: check OS to determine enterypoint
    });

    await container.start();
    const wait = await container.wait();
    await container.remove();

    if ('StatusCode' in wait && wait.StatusCode !== 0) {
      bin = await this.checkBin(runtime, bins, platform);
    }

    return bin;
  }
}
