import Docker, { ImageBuildOptions } from 'dockerode';
import tar, { Pack } from 'tar-fs';
import { existsSync, writeFileSync } from 'fs';
import { Entrypoint, ScaffoldlyConfig } from './config';
import { base58 } from '@scure/base';
import { join, sep } from 'path';
import { ui } from '../command';

type Path = string;

type DockerFileSpec = {
  base?: DockerFileSpec;
  from: string;
  as?: string;
  workdir?: string;
  copy?: string[];
  copyFrom?: {
    from: string;
    file: string;
    dest: string;
  }[];
  env?: { [key: string]: string };
  run?: string[];
  paths?: string[];
  entrypoint?: string;
};

/*
event {
  status: 'Extracting',
  progressDetail: { current: 142049280, total: 154096751 },
  progress: '[==============================================>    ]    142MB/154.1MB',
  id: '99a007e4650a'
}
*/

type DockerEvent = StreamEvent | StatusEvent;

type StatusEvent = {
  status?: string;
  progressDetail?: {
    current?: number;
    total?: number;
  };
  progress?: string;
  id?: string;
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

  async build(config: ScaffoldlyConfig, mode: Entrypoint) {
    const { spec } = await this.createSpec(config, mode);

    // const { files = [] } = config;

    // todo add dockerfile to tar instead of writing it to cwd
    const dockerfile = this.render(spec, mode);

    const dockerfilePath = join(this.cwd, `Dockerfile.${mode}`) as Path;
    writeFileSync(dockerfilePath, Buffer.from(dockerfile, 'utf-8'));

    const stream = tar.pack(this.cwd, {
      // filter: (name) => {
      //   return files.some((file) => name.startsWith(file));
      // },
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
      t: config.name,
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
  }

  async createSpec(
    config: ScaffoldlyConfig,
    mode: Entrypoint,
  ): Promise<{ spec: DockerFileSpec; stream?: Pack }> {
    const { runtime, bin = {} } = config;

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
      copy: [],
      // copyFrom: [
      //   {
      //     from: 'bootstrap',
      //     file: 'bootstrap',
      //     dest: '/bin/bootstrap',
      //   },
      // ],
      env: {
        _HANDLER: `base58:${base58.encode(new TextEncoder().encode(JSON.stringify(config)))}`,
        NODE_ENV: environment, // TODO Env File Interpolation
        HOSTNAME: '0.0.0.0',
      },
      entrypoint: 'bootstrap',
      paths: [join(workdir, 'node_modules', '.bin')],
    };

    if (mode === 'develop') {
      const { files = [] } = config;
      spec.copy = files;
    }

    if (mode === 'build') {
      const { build } = config.entrypoints || {};
      const { files = [], devFiles = [] } = config;
      if (!build) {
        throw new Error('Missing build entrypoint');
      }

      spec.base = {
        ...spec,
        as: 'builder',
        entrypoint: undefined,
        copyFrom: [],
        copy: [...files, ...devFiles],
        run: [build],
      };

      const copyFrom = files.map((file) => ({
        from: 'builder',
        file,
        dest: workdir,
      }));

      Object.entries(bin).forEach(([key, value]) => {
        const [dir, _] = splitPath(value);
        copyFrom.push({
          from: 'builder',
          file: `${dir}/`,
          dest: workdir,
        });
        copyFrom.push({
          from: 'builder',
          file: value,
          dest: join(workdir, key),
        });
      });

      spec.copyFrom = [...(spec.copyFrom || []), ...copyFrom];
    }

    return { spec };
  }

  render = (spec: DockerFileSpec, mode: Entrypoint): string => {
    const lines = [];

    if (spec.base) {
      lines.push(this.render(spec.base, mode));
      lines.push('');
    }

    const { copy, copyFrom, workdir, env = {}, entrypoint, run, paths = [] } = spec;

    const from = spec.as ? `${spec.from} as ${spec.as}` : spec.from;

    // lines.push('# syntax=docker/dockerfile:1');
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
      for (const file of copy) {
        const exists = existsSync(join(this.cwd, file));
        if (exists && workdir) {
          lines.push(`COPY ${file} ${join(workdir, file)}`);
        }
      }
    }

    if (copyFrom) {
      for (const cf of copyFrom) {
        const exists = existsSync(join(this.cwd, cf.file));
        if (workdir) {
          let source = join(workdir, cf.file);
          if (!exists) {
            source = `${source}*`;
          }
          lines.push(`COPY --from=${cf.from} ${source} ${cf.dest}`);
        }
      }
    }

    if (run) {
      lines.push(`RUN ${run.join(' && ')}`);
    }

    const dockerfile = lines.join('\n');

    return dockerfile;
  };
}
