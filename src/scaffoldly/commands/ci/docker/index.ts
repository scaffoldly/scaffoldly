import Docker, { AuthConfig, ImageBuildOptions } from 'dockerode';
import tar from 'tar-fs';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import {
  Script,
  ScaffoldlyConfig,
  DEFAULT_SRC_ROOT,
  Commands,
  Shell,
  ServiceName,
} from '../../../../config';
import { join, relative, sep } from 'path';
import { ui } from '../../../command';
import { isDebug } from '../../../ui';
import { BufferedWriteStream } from './util';
import { Platform } from '../../cd/docker';
import { PackageService } from './packages';
import micromatch from 'micromatch';

export type BuildInfo = { imageName?: string; imageTag?: string; entrypoint?: string[] };
export type PushInfo = { imageName?: string; imageDigest?: string };

const BASE = 'base';
type Path = string;

export type Architecture = 'x86_64' | 'arm64' | 'match-host';

type Copy = {
  from?: string;
  src: string;
  dest: string;
  noGlob?: boolean;
  resolve?: boolean;
  entrypoint?: boolean;
  bin?: {
    file: string;
    dir: string;
  };
  mode?: number;
};

export type RunCommand = {
  workdir?: string;
  cmds: string[];
  prerequisite: boolean;
};

type DockerStage = { [key: string]: DockerFileSpec | undefined };

type DockerStages = {
  bases: DockerStage;
  builds: DockerStage;
  packages: DockerStage;
  runtime: DockerFileSpec;
};

type DockerFileSpec = {
  // bases?: DockerFileSpec[];
  from: string;
  as: string;
  workdir?: string;
  copy?: Copy[];
  env?: { [key: string]: string | undefined };
  run?: RunCommand[];
  paths?: string[];
  cmd?: Commands;
  shell?: Shell;
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

  architecture: Architecture = 'match-host';

  constructor(private cwd: string) {
    this.docker = new Docker({ version: 'v1.45' });
  }

  private handleDockerEvent(type: 'Pull' | 'Build' | 'Push', event: DockerEvent) {
    console.log('!!! event', event);
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

  async describeBuild(): Promise<BuildInfo> {
    // TODO: Dynamic entrypoint
    // DEVNOTE: Entrypoint is set during prebuild so it must be known before deploy
    return { imageName: this.imageName, imageTag: this.imageTag, entrypoint: ['.entrypoint'] };
  }

  async generateDockerfile(
    config: ScaffoldlyConfig,
    mode: Script,
    env?: Record<string, string>,
  ): Promise<{ dockerfile: string; stages: DockerStages }> {
    const stages = await this.createStages(config, mode, env);

    if (isDebug()) {
      ui.updateBottomBarSubtext(`Stages: ${JSON.stringify(stages)}`);
    }

    const dockerfile = this.renderStages(stages);

    return { dockerfile, stages };
  }

  async build(
    config: ScaffoldlyConfig,
    mode: Script,
    architecture: Architecture,
    repositoryUri?: string,
    env?: Record<string, string>,
  ): Promise<void> {
    this.architecture = architecture;

    const tag = config.id ? `${config.version}-${config.id}` : config.version;

    const imageTag = `${config.name}:${tag}`;
    const imageName = repositoryUri ? `${repositoryUri}:${tag}` : imageTag;

    // todo add dockerfile to tar instead of writing it to cwd
    // const dockerfile = this.renderSpec(spec);
    const { dockerfile, stages } = await this.generateDockerfile(config, mode, env);

    const dockerfilePath = join(this.cwd, `Dockerfile.${mode}`) as Path;
    writeFileSync(dockerfilePath, Buffer.from(dockerfile, 'utf-8'));

    const stream = tar.pack(this.cwd, {
      filter: (path) => {
        const relativePath = relative(this.cwd, path);

        const exclude = config.buildFiles.some((buildFile) => {
          return !micromatch.isMatch(relativePath, buildFile, { contains: true });
        });

        if (exclude && isDebug()) {
          ui.updateBottomBarSubtext(`Excluding ${relativePath} from tarball`);
        }

        return exclude;
      },
    });

    stages.runtime.copy
      ?.filter((c) => c.resolve)
      .forEach((c) => {
        // This will remove the symlink and add the actual file
        const content = readFileSync(join(this.cwd, c.src));
        stream.entry(
          {
            name: c.dest,
            mode: c.mode,
          },
          content,
          () => {},
        );
      });

    const { runtime, runtimes } = config;
    if (!runtime) {
      throw new Error('Missing runtime');
    }

    const platform = await this.getPlatform(runtimes, architecture);

    // TODO: Multi-platform
    const buildStream = await this.docker.buildImage(stream, {
      dockerfile: dockerfilePath.replace(this.cwd, DEFAULT_SRC_ROOT),
      t: imageName,
      q: true,
      platform,
      version: '2', // FYI: Not in the type
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

    this.imageName = imageName;
    this.imageTag = imageTag;

    // TODO: Return SHA
  }

  async createStages(
    config: ScaffoldlyConfig,
    mode: Script,
    env?: Record<string, string>,
  ): Promise<DockerStages> {
    if (mode === 'develop') {
      // TODO
      return { runtime: { from: 'todo', as: 'todo' }, bases: {}, builds: {}, packages: {} };
    }

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

    return { bases, builds, packages, runtime };
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

    const { workdir, shell, runtime, src, files, scripts, bin } = config;

    const spec: DockerFileSpec = {
      from: `install-${name}`,
      as: `${mode}-${name}`,
      workdir: workdir,
      shell: shell,
      cmd: undefined,
      copy: [],
      paths: [],
      env: {
        ...(env || {}),
        SLY_DEBUG: isDebug() ? 'true' : undefined,
      },
      run: [],
    };

    if (mode === 'install') {
      spec.from = runtime;

      const runCommands = await packageService.commands;

      runCommands.push({
        cmds: scripts.install ? [scripts.install] : [],
        prerequisite: false,
        workdir: src !== DEFAULT_SRC_ROOT ? src : undefined,
      });

      if (scripts.install) {
        const copy: Copy[] = [{ src, dest: src }];
        if (src !== DEFAULT_SRC_ROOT) {
          files.forEach((file) => {
            const [from, f] = file.split(':');
            if (from && f) {
              copy.push({
                from: `${mode}-${from}`,
                src: join(src, f), // TODO figure out ".."
                dest: join(src, f),
              });
              return;
            }
            copy.push({ src: file, dest: file });
          });
        }
        spec.copy = copy;
      }

      spec.run = runCommands;

      return spec;
    }

    const paths = await packageService.paths;

    if (mode === 'build') {
      const fromStage = fromStages[`install-${name}`];

      spec.run = [
        {
          cmds: scripts.build ? [scripts.build] : [],
          prerequisite: false,
          workdir: src !== DEFAULT_SRC_ROOT ? src : undefined,
        },
      ];

      const copy: Copy[] = [{ src, dest: src }];
      if (src !== DEFAULT_SRC_ROOT) {
        files.forEach((file) => {
          const [from, f] = file.split(':');
          if (from && f) {
            copy.push({
              from: `${mode}-${from}`,
              src: join(src, f),
              dest: join(src, f),
            });
            return;
          }
          copy.push({ from: fromStage?.as, src: file, dest: file });
        });
      }

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
        const cp: Copy = { from: fromStage?.as, src: file, dest: file };
        return cp;
      });

      Object.entries(bin).forEach(([script, path]) => {
        if (!path) return;
        if (!fromStage) return;

        const scriptPath = join(src, script);
        const [binDir, binFile] = splitPath(path);

        paths.push(join(workdir, src, binDir));
        copy.push({
          from: fromStage.as,
          src: join(src, binDir),
          dest: join(src, binDir),
          bin: {
            file: binFile,
            dir: scriptPath === path ? binDir : src,
          },
          resolve: false,
        });
      });

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
          return (fromStage?.copy || []).map((c) => {
            if (c.bin) {
              paths.push(join(workdir, c.bin.dir));
              const cp: Copy = {
                from: fromStage?.as,
                src: `${c.src}${sep}`,
                dest: `${c.bin.dir}${sep}`,
                bin: c.bin,
              };
              return cp;
            }

            const cp: Copy = { ...c, from: key, noGlob: true };
            return cp;
          });
        })
        .flat();

      copy.push({
        src: join('node_modules', 'scaffoldly', 'dist', 'awslambda-entrypoint.js'),
        dest: `.entrypoint`,
        resolve: true,
        mode: 0o755,
        entrypoint: true,
      });

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

    const { bases, builds, packages, runtime } = stages;

    Object.values(bases).forEach((spec, ix) => {
      ui.updateBottomBarSubtext(`Rendering ${spec?.as} stage`);
      lines.push(this.renderSpec('install', spec, ix));
      lines.push('');
    });

    Object.values(builds).forEach((spec, ix) => {
      ui.updateBottomBarSubtext(`Rendering ${spec?.as} stage`);
      lines.push(this.renderSpec('build', spec, ix));
      lines.push('');
    });

    Object.values(packages).forEach((spec, ix) => {
      ui.updateBottomBarSubtext(`Rendering ${spec?.as} stage`);
      lines.push(this.renderSpec('package', spec, ix));
      lines.push('');
    });

    ui.updateBottomBarSubtext(`Rendering ${runtime.as} stage`);
    lines.push(this.renderSpec('start', runtime, 0));

    return lines.join('\n');
  };

  renderSpec = (mode: Script, spec: DockerFileSpec | undefined, ix: number): string => {
    const lines = [];

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

    const { copy, workdir, env = {}, run, paths = [], cmd, shell } = spec;

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

    const prereqRuns = run?.filter((r) => r.prerequisite && r.cmds.length);
    if (prereqRuns) {
      prereqRuns.forEach((r) => {
        if (r.workdir) {
          r.cmds.unshift(`cd ${r.workdir}`);
        }

        lines.push(`RUN ${r.cmds.join(' && ')}`);
      });
    }

    const copyLines = new Set<string>();
    if (copy) {
      copy
        .filter((c) => !c.from)
        .forEach((c) => {
          if (c.resolve && workdir) {
            copyLines.add(`COPY ${c.dest}* ${join(workdir, c.dest)}`);
            return;
          }

          if (c.src === DEFAULT_SRC_ROOT) {
            copyLines.add(`COPY ${c.src} ${workdir}${sep}`);
            return;
          }

          const exists = existsSync(join(this.cwd, c.src));
          if (exists && workdir) {
            copyLines.add(`COPY ${c.src} ${join(workdir, c.dest)}`);
          }
        });

      copy
        .filter((c) => !!c.from)
        .forEach((c) => {
          let { src } = c;
          if (src === DEFAULT_SRC_ROOT && workdir) {
            src = workdir;
          }

          if (c.noGlob && workdir) {
            copyLines.add(`COPY --from=${c.from} ${join(workdir, src)} ${join(workdir, c.dest)}`);
            return;
          }

          const exists = existsSync(join(this.cwd, src));
          if (workdir) {
            let source = join(workdir, src);
            if (!exists || c.bin) {
              source = `${source}*`;
            }
            copyLines.add(`COPY --from=${c.from} ${source} ${join(workdir, c.dest)}`);
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

  public async describePush(): Promise<PushInfo> {
    return { imageName: this.imageName, imageDigest: this.imageDigest };
  }

  public async push(imageName?: string, authConfig?: AuthConfig): Promise<void> {
    if (!imageName) {
      throw new Error('Missing image name');
    }

    const image = this.docker.getImage(imageName);

    const pushStream = await image.push({ authconfig: authConfig });

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

    this.imageDigest = event?.aux?.Digest;
  }

  private async getImages(runtimes: string[]): Promise<Docker.ImageInspectInfo[]> {
    const images = await Promise.all(
      runtimes.map(async (runtime) => {
        const image = await this.getImage(runtime);
        return image;
      }),
    );

    return images.filter((image) => !!image) as Docker.ImageInspectInfo[];
  }

  private async getImage(
    runtime: string,
    retry = true,
  ): Promise<Docker.ImageInspectInfo | undefined> {
    ui.updateBottomBarSubtext(`Getting image for ${runtime}`);
    const image = this.docker.getImage(runtime);

    let inspected: Docker.ImageInspectInfo | undefined = undefined;

    try {
      inspected = await image.inspect();
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }
      if ('statusCode' in e && e.statusCode === 404) {
        await this.pullImage(runtime);
      }
    }

    if (retry) {
      inspected = await this.getImage(runtime, false);
    }

    return inspected;
  }

  private async pullImage(runtime: string): Promise<void> {
    ui.updateBottomBarSubtext(
      `Pulling image for ${runtime} with architecture ${this.architecture}`,
    );
    let platform: Platform | undefined;

    switch (this.architecture) {
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

  public async getPlatform(runtimes: string[], architecture: Architecture): Promise<Platform> {
    this.architecture = architecture;

    const images = await this.getImages(runtimes);

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

    console.log('!!! checking bins', bins);

    const image = await this.getImage(runtime);

    console.log('!!! image', image);

    if (!image) {
      throw new Error(`Failed to get image for ${runtime}`);
    }

    if (!image.RepoDigests || !image.RepoDigests.length) {
      throw new Error(`Failed to get image digest for ${runtime}`);
    }

    let bin = bins.pop();

    console.log('!!! bin', bin);

    const writeStream = new BufferedWriteStream();
    console.log('!!! platform', platform);

    const container = await this.docker.createContainer({
      platform,
      Image: image.RepoDigests[0],
      Cmd: [`command -v ${bin}`],
      Tty: false,
      Entrypoint: ['/bin/sh', '-c'], // TODO: check OS to determine shell
    });

    console.log('!!! container', container);

    const start = await container.start();
    console.log('!!! start', start);

    const wait = await container.wait();
    console.log('!!! wait', wait);

    const inspection = await this.docker.getContainer(container.id).inspect();
    console.log('!!! inspection', inspection);

    const remove = await container.remove();
    console.log('!!! remove', remove);

    // const [output, container] = await this.docker.run(
    //   image.RepoDigests[0],
    //   [`command -v ${bin}`],
    //   writeStream,
    //   {
    //     Tty: false,
    //     Entrypoint: ['/bin/sh', '-c'], // TODO: check OS to determine shell
    //     platform,
    //   },
    // );

    console.log('!!! writeStream', writeStream.getString());

    if ('StatusCode' in wait && wait.StatusCode !== 0) {
      console.log('!!! checking next bin');
      bin = await this.checkBin(runtime, bins, platform);
    }

    return bin;
  }
}
