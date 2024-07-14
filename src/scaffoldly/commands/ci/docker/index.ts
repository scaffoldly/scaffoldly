import Docker, { AuthConfig, ImageBuildOptions } from 'dockerode';
import tar, { Pack } from 'tar-fs';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Script, ScaffoldlyConfig, DEFAULT_SRC_ROOT } from '../../../../config';
import { join, sep } from 'path';
import { isDebug } from '../../../ui';
import { bind } from 'lodash';

type Path = string;

type Copy = {
  from?: string;
  src: string;
  dest: string;
  noGlob?: boolean;
  resolve?: boolean;
  binFile?: string;
};

type DockerFileSpec = {
  bases?: DockerFileSpec[];
  from: string;
  as?: string;
  workdir?: string;
  copy?: Copy[];
  env?: { [key: string]: string | undefined };
  run?: {
    workdir?: string;
    cmds: string[];
  };
  paths?: string[];
  entrypoint?: string[];
  cmd?: string;
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

  constructor(private cwd: string) {
    this.docker = new Docker();
  }

  private handleDockerEvent(type: 'Pull' | 'Build' | 'Push', event: DockerEvent) {
    // console.log('!!! event', event);
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

    const { copy = [] } = spec;

    copy
      .filter((c) => c.resolve)
      .forEach((c) => {
        // This will remove the symlink and add the actual file
        const content = readFileSync(join(this.cwd, c.src));
        stream.entry(
          {
            name: c.dest,
            mode: 0o755,
          },
          content,
          () => {},
        );
      });

    const { runtime } = config;
    if (!runtime) {
      throw new Error('Missing runtime');
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

    const buildStream = await this.docker.buildImage(stream, {
      dockerfile: dockerfilePath.replace(this.cwd, DEFAULT_SRC_ROOT),
      t: imageName,
      forcerm: true,
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

    return { imageName, entrypoint };
  }

  async createSpec(
    config: ScaffoldlyConfig,
    mode: Script,
    ix = 0,
  ): Promise<{ spec: DockerFileSpec; entrypoint: string[]; stream?: Pack }> {
    const { runtime, bin = {}, services, src } = config;

    const serviceSpecs = await Promise.all(
      services.map((s, sIx) => this.createSpec(s, mode, ix + sIx + 1)),
    );

    const entrypointScript = join('node_modules', 'scaffoldly', 'dist', 'awslambda-entrypoint.js');
    const entrypointBin = `.entrypoint`;

    const serveScript = join('node_modules', 'scaffoldly', 'scripts', 'awslambda', 'serve.sh');
    const serveBin = `.serve`;

    if (!runtime) {
      throw new Error('Missing runtime');
    }

    const environment = mode === 'develop' ? 'development' : 'production';

    const workdir = join(sep, 'var', 'task');

    let spec: DockerFileSpec = {
      bases: [
        {
          from: runtime,
          as: `base-${ix}`,
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
      paths: [join(workdir, 'node_modules', '.bin'), workdir],
    };

    let { devFiles, files: additionalBuildFiles } = config;
    const { files } = config;

    console.log(`!!! devFiles for ${config.name}`, devFiles);
    if (devFiles.includes(DEFAULT_SRC_ROOT)) {
      // Already including the full source directiory, no need to copy more
      devFiles = [join(DEFAULT_SRC_ROOT, src)];
      additionalBuildFiles = files;
    }

    const buildFiles: Copy[] = [...devFiles, ...additionalBuildFiles].map((file) => {
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
          entrypoint: undefined,
          copy: buildFiles,
          workdir,
          run: {
            workdir: src === DEFAULT_SRC_ROOT ? workdir : join(workdir, src),
            cmds: [config.scripts.build],
          },
        },
      ];

      const copy = files.map(
        (file) =>
          ({
            from: `build-${ix}`,
            src: file,
            dest: join(workdir, file),
          } as Copy),
      );

      Object.entries(bin).forEach(([key, value]) => {
        const [binDir, binFile] = splitPath(value);
        copy.push({
          from: `build-${ix}`,
          src: binDir,
          dest: join(workdir, binDir),
          binFile,
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
      const copy = (spec.bases || [])
        .map((base) => {
          return (base.copy || []).map((c) => {
            return { ...c, from: base.as } as Copy;
          });
        })
        .flat()
        .filter((c) => !!c);
      spec.copy = copy;

      // Object.entries(bin).forEach(([key, value]) => {
      //   const [dir] = splitPath(value);
      //   copy.push({
      //     from: `build-${ix}`,
      //     src: `${join(workdir, dir)}`,
      //     noGlob: true,
      //     dest: `${workdir}${sep}`,
      //   });
      //   copy.push({
      //     from: `build-${ix}`,
      //     src: value,
      //     dest: join(workdir, key),
      //   });
      // });

      spec = {
        bases: [spec],
        from: `base-${ix}`,
        workdir,
        copy: [
          {
            src: serveScript,
            dest: serveBin,
            resolve: true,
          },
          {
            src: entrypointScript,
            dest: entrypointBin,
            resolve: true,
          },
          ...copy
            .map((c) => {
              if (c.binFile) {
                // console.log(`!!! c`, c);
                // const [dir] = splitPath(c.binFile);
                return [
                  {
                    from: `package-${ix}`,
                    src: join(workdir, c.src, c.binFile),
                    noGlob: true,
                    dest: `${workdir}${sep}`,
                  },
                  {
                    from: `package-${ix}`,
                    src: join(c.src, c.binFile),
                    dest: join(workdir, c.binFile),
                  },
                ] as Copy[];
              }
              return [{ ...c, from: `package-${ix}` } as Copy];
            })
            .flat(),
        ],
        cmd: config.scripts?.start,
      };
    }

    return { spec, entrypoint: [join(workdir, serveBin), join(workdir, entrypointBin)] };
  }

  render = (spec: DockerFileSpec, mode: Script): string => {
    const lines = [];

    if (spec.bases) {
      for (const base of spec.bases) {
        lines.push(this.render(base, mode));
        lines.push('');
      }
    }

    const { copy, workdir, env = {}, entrypoint, run, paths = [], cmd } = spec;

    const from = spec.as ? `${spec.from} as ${spec.as}` : spec.from;

    lines.push(`FROM ${from}`);
    if (entrypoint) lines.push(`ENTRYPOINT [${entrypoint.map((ep) => `"${ep}"`).join(',')}]`);
    if (workdir) lines.push(`WORKDIR ${workdir}`);

    for (const path of paths) {
      lines.push(`ENV PATH="${path}:$PATH"`);
    }

    for (const [key, value] of Object.entries(env)) {
      if (value) {
        lines.push(`ENV ${key}="${value}"`);
      }
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
            copyLines.add(`COPY ${c.src} ${workdir}/`);
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

          if (c.noGlob) {
            copyLines.add(`COPY --from=${c.from} ${src} ${c.dest}`);
            return;
          }

          const exists = existsSync(join(this.cwd, src));
          if (workdir) {
            let source = join(workdir, src);
            if (!exists) {
              source = `${source}*`;
            }
            copyLines.add(`COPY --from=${c.from} ${source} ${c.dest}`);
          }
        });
    }
    lines.push(...copyLines);

    if (run) {
      if (run.workdir) {
        lines.push(`WORKDIR ${run.workdir}`);
      }
      lines.push(`RUN ${run.cmds.join(' && ')}`);
    }

    if (cmd) {
      lines.push(
        `CMD [${cmd
          .split(' ')
          .map((c) => `"${c}"`)
          .join(', ')}]`,
      );
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
}
