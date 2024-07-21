import Docker, { AuthConfig, ImageBuildOptions } from 'dockerode';
import tar, { Pack } from 'tar-fs';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import {
  Script,
  ScaffoldlyConfig,
  DEFAULT_SRC_ROOT,
  ServeCommands,
  Shell,
} from '../../../../config';
import { join, sep } from 'path';
import { ui } from '../../../command';
import { isDebug } from '../../../ui';
import { BufferedWriteStream } from './util';

type Path = string;

type Copy = {
  from?: string;
  src: string;
  dest: string;
  noGlob?: boolean;
  resolve?: boolean;
  bin?: {
    file: string;
    dir: string;
  };
};

type RunCommand = {
  workdir?: string;
  cmds: string[];
  prerequisite: boolean;
};

type DockerFileSpec = {
  bases?: DockerFileSpec[];
  from: string;
  as?: string;
  workdir?: string;
  copy?: Copy[];
  env?: { [key: string]: string | undefined };
  run?: RunCommand[];
  paths?: string[];
  cmd?: ServeCommands;
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

const filesToResolve = (spec: DockerFileSpec): Copy[] => {
  const files = new Set<Copy>();

  if (spec.copy) {
    spec.copy.forEach((c) => {
      if (c.resolve) {
        files.add(c);
      }
    });
  }

  if (spec.bases) {
    spec.bases.forEach((b) => {
      filesToResolve(b).forEach((f) => files.add(f));
    });
  }

  return Array.from(files);
};

export class DockerService {
  docker: Docker;

  constructor(private cwd: string) {
    this.docker = new Docker();
  }

  private handleDockerEvent(type: 'Pull' | 'Build' | 'Push', event: DockerEvent) {
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

  async build(
    config: ScaffoldlyConfig,
    mode: Script,
    repositoryUri?: string,
  ): Promise<{ imageName: string; entrypoint: string[] }> {
    const { spec, entrypoint } = await this.createSpec(config, mode);

    const imageName = repositoryUri
      ? `${repositoryUri}:${config.version}`
      : `${config.name}:${mode}`;

    // todo add dockerfile to tar instead of writing it to cwd
    const dockerfile = this.render(spec, mode);

    const dockerfilePath = join(this.cwd, `Dockerfile.${mode}`) as Path;
    writeFileSync(dockerfilePath, Buffer.from(dockerfile, 'utf-8'));

    const stream = tar.pack(this.cwd, {
      // filter: (name) => {
      //   if ([...staticBins].find((file) => name === join(this.cwd, file))) {
      //     return true;
      //   }
      //   return false;
      // },
    });

    filesToResolve(spec).forEach((c) => {
      // This will remove the symlink and add the actual file
      const content = readFileSync(join(this.cwd, c.src));
      stream.entry(
        {
          name: c.dest,
          mode: 0o755, // TODO: Make configurable
        },
        content,
        () => {},
      );
    });

    const { runtime } = config;
    if (!runtime) {
      throw new Error('Missing runtime');
    }

    const buildStream = await this.docker.buildImage(stream, {
      dockerfile: dockerfilePath.replace(this.cwd, DEFAULT_SRC_ROOT),
      t: imageName,
      // forcerm: true,
      // version: '2', // FYI: Not in the type
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

    return { imageName, entrypoint };
  }

  async createSpec(
    config: ScaffoldlyConfig,
    mode: Script,
    ix = 0,
  ): Promise<{ spec: DockerFileSpec; entrypoint: string[]; stream?: Pack }> {
    const { runtime, bin = {}, services, src, shell, packages } = config;

    const serviceSpecs = await Promise.all(
      services.map((s, sIx) => this.createSpec(s, mode, ix + sIx + 1)),
    );

    const entrypointScript = join('node_modules', 'scaffoldly', 'dist', 'awslambda-entrypoint.js');
    const entrypointBin = `.entrypoint`;

    if (!runtime) {
      throw new Error('Missing runtime');
    }

    const environment = mode === 'develop' ? 'development' : 'production';

    const workdir = join(sep, 'var', 'task');

    const paths = [join(workdir, src)];

    Object.entries(bin).forEach(([script, path]) => {
      if (!path) return;
      const scriptPath = join(src, script);
      const [binDir] = splitPath(path);
      if (scriptPath === path) {
        paths.push(join(workdir, binDir));
      }
    });

    let spec: DockerFileSpec = {
      bases: [
        {
          from: runtime,
          as: `base-${ix}`,
          workdir,
          paths: [workdir],
          run: await this.installPackages(runtime, packages),
          shell,
        },
        ...serviceSpecs.map((s) => s.spec),
      ],
      from: `base-${ix}`,
      as: `package-${ix}`,
      workdir,
      env: {
        NODE_ENV: environment, // TODO Env File Interpolation
        HOSTNAME: '0.0.0.0',
        SLY_DEBUG: isDebug() ? 'true' : undefined,
      },
      shell,
    };

    let { devFiles, files: additionalBuildFiles } = config;
    const { files } = config;

    // HACK: include node_modules/.bin in path
    //       this is a hack because it seems like there's a better way to infer this
    if (files.includes('node_modules') || devFiles.includes('node_modules')) {
      paths.push(join(workdir, src, 'node_modules', '.bin'));
    }

    spec.paths = paths;

    if (devFiles.includes(DEFAULT_SRC_ROOT)) {
      // Already including the full source directiory, no need to copy more
      devFiles = [join(DEFAULT_SRC_ROOT, src)];
      additionalBuildFiles = files;
    }

    const buildFiles: Copy[] = [...additionalBuildFiles, ...devFiles].map((file) => {
      const copy: Copy = {
        src: file,
        dest: file,
      };
      return copy;
    });

    if (mode === 'develop' && config.scripts.develop) {
      spec.copy = buildFiles;
    }

    if (mode === 'build' && config.scripts.build) {
      spec.bases = [
        {
          ...spec,
          as: `build-${ix}`,
          copy: buildFiles,
          workdir,
          run: [
            {
              workdir: src !== DEFAULT_SRC_ROOT ? join(workdir, src) : undefined,
              cmds: [config.scripts.build],
              prerequisite: false,
            },
          ],
        },
      ];

      const copy = files.map(
        (file) =>
          ({
            from: `build-${ix}`,
            src: file,
            dest: file,
          } as Copy),
      );

      Object.entries(bin).forEach(([script, path]) => {
        if (!path) return;
        const scriptPath = join(src, script);
        const [binDir, binFile] = splitPath(path);
        copy.push({
          from: `build-${ix}`,
          src: binDir,
          dest: binDir,
          bin: {
            file: binFile,
            dir: scriptPath === path ? binDir : src,
          },
          resolve: false,
        });
      });

      spec.copy = [...(spec.copy || []), ...copy].map((c) => {
        const srcGlobIx = c.src.indexOf('*');
        if (srcGlobIx !== -1) {
          c.src = c.src.slice(0, srcGlobIx);
        }
        const destGlobIx = c.dest.indexOf('*');
        if (destGlobIx !== -1) {
          c.dest = c.dest.slice(0, destGlobIx);
        }

        return c;
      });
    }

    if (mode === 'build' && ix === 0) {
      const copy = [spec, ...(spec.bases || [])]
        .map((s) => {
          return (s.copy || []).map((c) => {
            let from = s.as;
            if (c.bin) {
              from = c.from;
            }
            return { ...c, from } as Copy;
          });
        })
        .flat()
        .filter((c) => !!c && c.src !== DEFAULT_SRC_ROOT);

      // spec.copy = copy.filter((c) => !!c.bin || c.from !== spec.as);

      if (spec.paths) {
        paths.push(...spec.paths);
      }

      copy.forEach((c) => {
        if (c.bin) {
          paths.push(join(workdir, c.bin.dir));
        }
      });

      spec = {
        ...spec,
        bases: [spec],
        as: undefined,
        from: `base-${ix}`,
        paths,
        copy: [
          // {
          //   src: serveScript,
          //   dest: serveBin,
          //   resolve: true,
          // },
          {
            src: entrypointScript,
            dest: entrypointBin,
            resolve: true,
          },
          ...(copy || [])
            .map((c) => {
              if (c.bin) {
                return [
                  {
                    from: `package-${ix}`,
                    src: `${c.src}${sep}`,
                    dest: `${c.bin.dir}${sep}`,
                    bin: c.bin,
                  },
                ] as Copy[];
              }
              return [{ ...c, from: `package-${ix}` } as Copy];
            })
            .flat(),
        ],
        cmd: config.serveCommands,
      };
    }

    return {
      spec,
      // entrypoint: [join(workdir, serveBin), join(workdir, entrypointBin)],
      entrypoint: [join(workdir, entrypointBin)],
    };
  }

  render = (spec: DockerFileSpec, mode: Script): string => {
    const lines = [];

    if (spec.bases) {
      for (const base of spec.bases) {
        lines.push(this.render(base, mode));
        lines.push('');
      }
    }

    const { copy, workdir, env = {}, run, paths = [], cmd, shell } = spec;

    const from = spec.as ? `${spec.from} as ${spec.as}` : spec.from;

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
          lines.push(`WORKDIR ${r.workdir}`);
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
            copyLines.add(`COPY --from=${c.from} ${src} ${join(workdir, c.dest)}`);
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
        let rundir = workdir;
        if (r.workdir) {
          rundir = r.workdir;
          lines.push(`WORKDIR ${r.workdir}`);
        }

        if (shell === 'direnv') {
          lines.push(`RUN direnv allow`);
          // TODO: infer default /bin/sh command from base image
          // TODO: does entrypoint need to be added to lambda runtime?
          lines.push(`SHELL ["/bin/sh", "-c", "direnv exec ${rundir} /bin/sh"]`);
        }

        lines.push(`RUN ${r.cmds.join(' && ')}`);
      });
    }

    if (shell === 'direnv') {
      lines.push(`ENTRYPOINT ["/bin/sh", "-c", "direnv exec ${workdir} /bin/sh"]`);
    }

    if (cmd) {
      lines.push(`CMD ${cmd.toString()}`);
    }

    const dockerfile = lines.join('\n');

    return dockerfile;
  };

  public async push(
    imageName: string,
    authConfig: AuthConfig,
  ): Promise<{ imageDigest: string; architecture: string }> {
    const image = this.docker.getImage(imageName);

    const { Architecture: architecture } = await image.inspect();

    if (architecture !== 'amd64' && architecture !== 'arm64') {
      throw new Error(`Unsupported architecture: ${architecture}`);
    }

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

    const imageDigest = event?.aux?.Digest;

    if (!imageDigest) {
      throw new Error('Failed to push image');
    }

    return { imageDigest, architecture };
  }

  private installPackages = async (runtime: string, packages?: string[]): Promise<RunCommand[]> => {
    if (!packages || !packages.length) {
      return [];
    }

    const bin = await this.checkBin(runtime, ['apk', 'apt', 'dnf', 'yum']);

    switch (bin) {
      case 'apk':
        return [
          {
            prerequisite: true,
            cmds: [
              `apk update`,
              `apk add --no-cache ${packages.join(' ')}`,
              `rm -rf /var/cache/apk/*`,
            ],
          },
        ];
      case 'apt':
        return [
          {
            prerequisite: true,
            cmds: [
              `apt update`,
              `apt install -y --no-install-recommends ${packages.join(' ')}`,
              `apt clean && rm -rf /var/lib/apt/lists/*`,
            ],
          },
        ];
      case 'dnf':
        return [
          {
            prerequisite: true,
            cmds: [
              `dnf install -y ${packages.join(' ')}`,
              `dnf clean all`,
              `rm -rf /var/cache/dnf`,
            ],
          },
        ];
      case 'yum':
        return [
          {
            prerequisite: true,
            cmds: [
              `yum install -y ${packages.join(' ')}`,
              `yum clean all`,
              `rm -rf /var/cache/yum`,
            ],
          },
        ];
      default:
        throw new Error(`Unable to determine find a package manager in ${runtime}`);
    }
  };

  private async checkBin<T extends string[]>(
    runtime: string,
    bins: [...T],
  ): Promise<T[number] | undefined> {
    if (!bins || !bins.length) {
      return undefined;
    }

    const pullStream = await this.docker.pull(runtime);

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

    const bin = bins.pop();

    const [output, container] = await this.docker.run(
      runtime,
      [`command -v ${bin}`],
      new BufferedWriteStream(),
      {
        Tty: false,
        Entrypoint: ['/bin/sh', '-c'], // TODO: check OS to determine shell
      },
    );

    try {
      await container.remove();
    } catch (e) {
      // ignore, TODO: log error
    }

    if ('StatusCode' in output && output.StatusCode !== 0) {
      return this.checkBin(runtime, bins);
    }

    return bin;
  }
}
