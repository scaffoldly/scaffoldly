import Docker, { ImageBuildOptions } from 'dockerode';
import tar, { Pack } from 'tar-fs';
import { existsSync, writeFileSync } from 'fs';
import { Entrypoint, ScaffoldlyConfig } from './config';
import { base58 } from '@scure/base';
import { join } from 'path';
import { ui } from '../command';

type Path = string;

type DockerFileSpec = {
  base?: DockerFileSpec;
  from: string;
  as?: string;
  workdir: string;
  copy?: string[];
  copyFrom?: {
    from: string;
    file: string;
  }[];
  env: { [key: string]: string };
  run?: string[];
  entrypoint: string;
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

    const buildStream = await this.docker.buildImage(stream, {
      dockerfile: dockerfilePath.replace(this.cwd, './'),
      t: config.name,
      // pull: 'true',
      // forcerm: true,
      version: '2', // FYI: Not in the type
    } as ImageBuildOptions);

    const foo = await new Promise<any[]>((resolve, reject) => {
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

    console.log('!!! foo', foo);

    // console.log('!!! stuffs', stuffs);
  }

  async createSpec(
    config: ScaffoldlyConfig,
    mode: Entrypoint,
  ): Promise<{ spec: DockerFileSpec; stream?: Pack }> {
    const workdir = '/app';
    const builder = 'builder';

    const { runtime } = config;

    if (!runtime) {
      throw new Error('Missing runtime');
    }

    let spec: DockerFileSpec = {
      from: runtime,
      workdir: workdir,
      copy: [],
      env: {
        _HANDLER: `base58:${base58.encode(new TextEncoder().encode(JSON.stringify(config)))}`,
      },
      entrypoint: '/bin/bootstrap', // TODO How to get this installed
    };

    if (mode === 'develop') {
      const { files = [] } = config;
      spec.copy = files;
    }

    if (mode === 'build' || mode === 'serve') {
      const { build } = config.entrypoints || {};
      const { files = [], devFiles = [] } = config;
      if (!build) {
        throw new Error('Missing build entrypoint');
      }

      spec.base = {
        ...spec,
        copy: [...files, ...devFiles],
        as: builder,
        run: [build],
      };

      spec.copyFrom = files.map((file) => ({
        from: builder,
        file,
      }));
    }

    if (!spec) {
      throw new Error('No Dockerfile generated');
    }

    return { spec };
  }

  render = (spec: DockerFileSpec, mode: Entrypoint): string => {
    const lines = [];

    if (spec.base) {
      lines.push(this.render(spec.base, mode));
    }

    const { copy, copyFrom, workdir, env, entrypoint, run } = spec;

    const from = spec.as ? `${spec.from} as ${spec.as}` : spec.from;

    // lines.push('# syntax=docker/dockerfile:1');
    lines.push(`FROM ${from}`);
    lines.push(`ENTRYPOINT ${entrypoint}`);
    lines.push(`WORKDIR ${workdir}`);

    for (const [key, value] of Object.entries(env)) {
      lines.push(`ENV ${key}="${value}"`);
    }

    if (copy) {
      for (const file of copy) {
        const exists = existsSync(join(this.cwd, file));
        if (exists) {
          lines.push(`COPY ${file} ${join(workdir, file)}`);
        }
      }
    }

    if (run) {
      lines.push(`RUN ${run.join(' && ')}`);
    }

    if (copyFrom) {
      for (const cf of copyFrom) {
        const exists = existsSync(join(this.cwd, cf.file));
        let source = join(workdir, cf.file);
        if (!exists) {
          source = `${source}*`;
        }
        lines.push(`COPY --from=${cf.from} ${source} ${join(workdir, cf.file)}`);
      }
    }

    const dockerfile = lines.join('\n');

    return dockerfile;
  };
}
