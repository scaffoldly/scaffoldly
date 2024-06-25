import Docker, { AuthConfig, ImageBuildOptions } from 'dockerode';
import tar, { Pack } from 'tar-fs';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Script, ScaffoldlyConfig, encode } from '../../../../config';
import { join, sep } from 'path';
import { ui } from '../../../command';

type Path = string;

type Copy = {
  from?: string;
  src: string;
  dest: string;
  noGlob?: boolean;
  resolve?: boolean;
};

type DockerFileSpec = {
  base?: DockerFileSpec;
  from: string;
  as?: string;
  workdir?: string;
  copy?: Copy[];
  env?: { [key: string]: string };
  run?: string[];
  paths?: string[];
  entrypoint?: string;
};

type DockerEvent = StreamEvent | StatusEvent | AuxEvent;

type StatusEvent = {
  status?: string;
  progressDetail?: {
    current?: number;
    total?: number;
  };
  progress?: string;
  id?: string;
};

type AuxEvent = {
  progressDetail?: {};
  aux?: {
    Digest?: string;
  };
};

type StreamEvent = {
  stream?: string;
};

const splitPath = (path: string): [string, string] => {
  const parts = path.split(sep);
  return [parts.slice(0, -1).join(sep), parts.pop() as string];
};

export class DockerService {
  bottomBar: { [key: string]: string | undefined } = {};
  docker: Docker;

  constructor(private cwd: string) {
    this.docker = new Docker();
  }

  private log(event: DockerEvent) {
    console.log('!!! event', event);

    if ('stream' in event) {
      const { stream } = event;
      if (stream && typeof stream === 'string') {
        stream.replace('\\n', '').trim();
        if (stream) {
          this.bottomBar.status = stream;
        }
      }
    }

    if ('status' in event && !event.progressDetail) {
      this.bottomBar.status = event.status;
    }

    if ('status' in event && event.progressDetail) {
      const { id, status, progress, progressDetail } = event;
      if (id && status && progress) {
        this.bottomBar[id] = `${event.status}: ${event.progress}`;
      }
      if (id && status && !progress) {
        this.bottomBar[id] = status;
      }
      if (id && !progress && !progressDetail) {
        delete this.bottomBar[id];
      }
    }

    const lines = Object.entries(this.bottomBar)
      .filter(([key, value]) => key !== 'status' && !!value)
      .map(([key, value]) => `[${key}] ${value}`);

    if (this.bottomBar.status) {
      lines.push(`Status: ${this.bottomBar.status}`);
    }

    // ui.updateBottomBar(lines.join('\n'));

    console.log('!!! bottom bar lines', lines);
  }

  async build(
    config: ScaffoldlyConfig,
    mode: Script,
    repositoryUri?: string,
  ): Promise<{ imageName: string }> {
    const { spec } = await this.createSpec(config, mode);

    let imageName = repositoryUri ? `${repositoryUri}:${config.version}` : `${config.name}:${mode}`;

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
      .filter((copy) => copy.resolve)
      .forEach((copy) => {
        // This will remove the symlink and add the actual file
        const content = readFileSync(join(this.cwd, copy.src));
        stream.entry(
          {
            name: copy.dest,
            mode: 0o755,
          },
          content,
          () => {
            console.log('!!! added bin: ', copy.dest);
          },
        );
      });

    const { runtime } = config;
    if (!runtime) {
      throw new Error('Missing runtime');
    }

    const pullStream = await this.docker.pull(runtime);

    const pullOutput = await new Promise<DockerEvent[]>((resolve, reject) => {
      this.docker.modem.followProgress(
        pullStream,
        (err, res) => {
          err ? reject(err) : resolve(res);
        },
        (event) => {
          this.log(event);
        },
      );
    });

    console.log('!!! pullOutput', pullOutput);

    const buildStream = await this.docker.buildImage(stream, {
      dockerfile: dockerfilePath.replace(this.cwd, './'),
      t: imageName,
      forcerm: true,
      version: '2', // FYI: Not in the type
    } as ImageBuildOptions);

    const buildOutput = await new Promise<DockerEvent[]>((resolve, reject) => {
      this.docker.modem.followProgress(
        buildStream,
        (err, res) => {
          err ? reject(err) : resolve(res);
        },
        (event) => {
          this.log(event);
        },
      );
    });

    ui.updateBottomBar('');

    console.log('!!! buildOutput', buildOutput);

    // console.log('!!! stuffs', stuffs);

    return { imageName };
  }

  async createSpec(
    config: ScaffoldlyConfig,
    mode: Script,
  ): Promise<{ spec: DockerFileSpec; stream?: Pack }> {
    const { runtime, bin = {} } = config;

    const bootstrap = join('node_modules', 'scaffoldly', 'dist', 'awslambda-bootstrap.js');
    const entrypoint = 'bootstrap';

    if (!runtime) {
      throw new Error('Missing runtime');
    }

    const environment = mode === 'develop' ? 'development' : 'production';

    const workdir = '/var/task';

    const spec: DockerFileSpec = {
      base: {
        // base: {
        from: runtime,
        as: 'base',
        // },
        // from: 'scaffoldly/awslambda-bootstrap:latest',
        // as: 'bootstrap',
      },
      from: 'base',
      as: 'runner',
      workdir,
      copy: [
        {
          src: bootstrap,
          dest: entrypoint,
          resolve: true,
        },
      ],
      env: {
        CONFIG: encode(config),
        NODE_ENV: environment, // TODO Env File Interpolation
        HOSTNAME: '0.0.0.0',
        SLY_DEBUG: 'true',
      },
      paths: [join(workdir, 'node_modules', '.bin'), workdir],
      entrypoint: join(workdir, entrypoint),
    };

    const { files = [], devFiles = ['.'] } = config;
    const buildFiles: Copy[] = [...devFiles, ...files].map(
      (file) =>
        ({
          src: file,
          dest: file,
        } as Copy),
    );

    if (mode === 'develop') {
      spec.copy = buildFiles;
    }

    if (mode === 'build') {
      console.log('!!!entrypoints', config);
      const { build } = config.scripts || {};
      const { files = [] } = config;
      if (!build) {
        throw new Error('Missing build entrypoint');
      }

      spec.base = {
        ...spec,
        as: 'builder',
        entrypoint: undefined,
        copy: buildFiles,
        run: [build],
      };

      const copy = files.map(
        (file) =>
          ({
            from: 'builder',
            src: file,
            dest: join(workdir, file),
          } as Copy),
      );

      Object.entries(bin).forEach(([key, value]) => {
        const [dir, _] = splitPath(value);
        copy.push({
          from: 'builder',
          src: `${join(workdir, dir)}`,
          noGlob: true,
          dest: `${workdir}${sep}`,
        });
        copy.push({
          from: 'builder',
          src: value,
          dest: join(workdir, key),
        });
      });

      spec.copy = [...(spec.copy || []), ...copy];
    }

    return { spec };
  }

  render = (spec: DockerFileSpec, mode: Script): string => {
    console.log('!!! spec', JSON.stringify(spec, null, 2));

    const lines = [];

    if (spec.base) {
      lines.push(this.render(spec.base, mode));
      lines.push('');
    }

    const { copy, workdir, env = {}, entrypoint, run, paths = [] } = spec;

    const from = spec.as ? `${spec.from} as ${spec.as}` : spec.from;

    lines.push(`FROM ${from}`);
    if (entrypoint) lines.push(`ENTRYPOINT ${entrypoint}`);
    if (workdir) lines.push(`WORKDIR ${workdir}`);

    for (const path of paths) {
      lines.push(`ENV PATH="${path}:$PATH"`);
    }

    for (const [key, value] of Object.entries(env)) {
      lines.push(`ENV ${key}="${value}"`);
    }

    if (copy) {
      copy
        .filter((c) => !c.from)
        .forEach((c) => {
          if (c.resolve && workdir) {
            lines.push(`COPY ${c.dest}* ${join(workdir, c.dest)}`);
            return;
          }

          if (c.src === '.') {
            lines.push(`COPY . ${workdir}/`);
            return;
          }

          const exists = existsSync(join(this.cwd, c.src));
          if (exists && workdir) {
            lines.push(`COPY ${c.src} ${join(workdir, c.dest)}`);
          }
        });

      copy
        .filter((c) => !!c.from)
        .forEach((c) => {
          let { src } = c;
          if (src === '.' && workdir) {
            src = workdir;
          }

          if (c.noGlob) {
            lines.push(`COPY --from=${c.from} ${src} ${c.dest}`);
            return;
          }

          const exists = existsSync(join(this.cwd, src));
          if (workdir) {
            let source = join(workdir, src);
            if (!exists) {
              source = `${source}*`;
            }
            lines.push(`COPY --from=${c.from} ${source} ${c.dest}`);
          }
        });
    }

    if (run) {
      lines.push(`RUN ${run.join(' && ')}`);
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
        (err, res) => {
          err ? reject(err) : resolve(res);
        },
        (event) => {
          this.log(event);
        },
      );
    });

    const event = events.find((event) => 'aux' in event) as AuxEvent | undefined;

    const imageDigest = event?.aux?.Digest;

    if (!imageDigest) {
      throw new Error('Failed to push image');
    }

    return { imageDigest, architecture };
  }
}
