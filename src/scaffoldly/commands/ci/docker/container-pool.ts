import Dockerode from 'dockerode';
import { BehaviorSubject, concatMap, Subject, Subscription, timer } from 'rxjs';
import { DockerService } from '.';
import { GitService } from '../../cd/git';
import { EnvService } from '../env';
import { RUNTIME_SERVER_PORT } from '../aws/lambda/lambda-runtime-server';
import { uniqueId } from 'lodash';
import { DevServer } from '../server/dev-server';
import path, { join } from 'path';
import { readdirSync } from 'fs';
import promiseRetry from 'promise-retry';

export type ContainerRef = {
  name: string;
  runtimeApi: string;
  disposed?: boolean;
};

class DelayedSubject<T extends { disposed?: boolean }> extends Subject<T> {
  private delayTime: number;

  constructor(delayTime: number) {
    super();
    this.delayTime = delayTime;
  }

  next(value: T): void {
    const actualDelayTime = value.disposed ? 0 : this.delayTime;
    timer(actualDelayTime)
      .pipe(concatMap(async () => super.next(value)))
      .subscribe();
  }
}

export type ContainerPoolMap = Map<string, ContainerRef>;

export class ContainerPool extends DevServer {
  private dockerAbortController = new AbortController();

  private abortSignal = this.dockerAbortController.signal;

  protected readonly docker: Dockerode;

  private _imageName?: string;

  private pool: ContainerPoolMap = new Map();

  private pending$: Subject<ContainerRef>;

  private started$: Subject<ContainerRef>;

  private starting$: Subject<ContainerRef>;

  private garbage$: Subject<ContainerRef>;

  private deleted$: Subject<ContainerRef>;

  private subscriptions: Subscription[] = [];

  private concurrency$: BehaviorSubject<{ current: number; desired: number; max: number }> =
    new BehaviorSubject({ current: 0, desired: 0, max: 0 });

  // private memory = 1024; // TODO

  constructor(
    abortController: AbortController,
    private gitService: GitService,
    dockerService: DockerService,
    private envService: EnvService,
    protected readonly options = { lifetime: 900, maxConcurrency: 10 },
  ) {
    super('Container Pool', abortController);
    this.docker = dockerService.docker;
    this.pending$ = new Subject<ContainerRef>();
    this.starting$ = new Subject<ContainerRef>();
    this.started$ = new Subject<ContainerRef>();
    this.garbage$ = new DelayedSubject<ContainerRef>(this.options.lifetime * 1000);
    this.deleted$ = new Subject<ContainerRef>();

    this.subscriptions.push(
      this.concurrency$.subscribe(({ current, desired }) => {
        if (current < desired) {
          const containerRef: ContainerRef = {
            name: uniqueId(this.gitService.config.name),
            runtimeApi: `host.docker.internal:${RUNTIME_SERVER_PORT}`,
          };

          this.pool.set(containerRef.name, containerRef);

          // Start one at a time
          this.pending$.next(containerRef);
        }
      }),
    );
  }

  get imageName(): string {
    if (!this._imageName) {
      throw new Error('Image name not set');
    }
    return this._imageName;
  }

  set imageName(name: string) {
    this._imageName = name;
  }

  setConcurrency(desired = this.concurrency$.value.desired): void {
    const current = this.pool.size;
    desired = Math.min(desired, this.options.maxConcurrency);
    this.concurrency$.next({ current, desired, max: this.options.maxConcurrency });
  }

  async start(): Promise<void> {
    this.subscriptions.push(
      this.pending$.subscribe(async (containerRef) => {
        await this.createContainer(containerRef)
          .then(() => this.starting$.next(containerRef))
          .catch(() => this.garbage$.next(containerRef));
      }),
      this.starting$.subscribe(async (containerRef) => {
        await this.startContainer(containerRef)
          .then(() => this.started$.next(containerRef))
          .catch(() => this.garbage$.next(containerRef));
      }),
      this.started$.subscribe(async (containerRef) => {
        this.garbage$.next(containerRef);
        this.setConcurrency();
      }),
      this.garbage$.subscribe(async (containerRef) => {
        await this.removeContainer(containerRef)
          .then(() => this.deleted$.next(containerRef))
          .catch(() => this.deleted$.next(containerRef));
      }),
      this.deleted$.subscribe(async (containerRef) => {
        this.pool.delete(containerRef.name);
      }),
    );
  }

  async stop(): Promise<void> {
    this.dockerAbortController.abort();
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  private async createContainer(ref: ContainerRef): Promise<ContainerRef> {
    try {
      const env = this.envService.dockerEnv;
      const mounts = await this.mounts;
      env.unshift(`AWS_LAMBDA_RUNTIME_API=${ref.runtimeApi}`);

      const container = await promiseRetry((retry) =>
        this.docker
          .createContainer({
            name: ref.name,
            Hostname: ref.name,
            Image: this.imageName,
            AttachStderr: false, // TODO: Capture output
            AttachStdout: false, // TODO: Capture output
            AttachStdin: false,
            Tty: false,
            Env: env,
            Cmd: [], // TODO
            Entrypoint: ['.entrypoint'],
            abortSignal: this.abortSignal,
            HostConfig: {
              NetworkMode: 'bridge',
              // TODO: AutoRemove doesn't seem to be working very well, some containers left unremoved
              // AutoRemove: true,
              Mounts: mounts,
              // Memory: 1024 * 1024 * 1024, // TODO
            },
          })
          .catch(async (e) => {
            if ('statusCode' in e && e.statusCode === 409) {
              return this.removeContainer(ref).then(() => retry(e));
            }
            throw e;
          }),
      );

      container.attach(
        {
          abortSignal: this.abortSignal,
          stream: true,
          stdout: true,
          stderr: true,
        },
        (err, stream) => {
          if (err) {
            if (!(err instanceof Error)) {
              throw err;
            }
            console.warn(`Unable to attach to container: ${err.message}`);
            return;
          }
          container.modem.demuxStream(stream, this.stdout, this.stderr);

          if (stream) {
            stream.on('end', () => {
              this.log(`Disposing ${ref.name}...`);
              ref.disposed = true;
              this.garbage$.next(ref);
            });
          }
        },
      );

      return ref;
    } catch (e) {
      this.warn('Unable to create container', { cause: e });
      throw new Error('Unable to create container', { cause: e });
    }
  }

  private async startContainer(ref: ContainerRef): Promise<ContainerRef> {
    try {
      const container = this.docker.getContainer(ref.name);
      await container.start({ abortSignal: this.abortSignal });
    } catch (e) {
      this.warn('Unable to start container', { cause: e });
      throw new Error('Unable to start container', { cause: e });
    }

    return ref;
  }

  private async removeContainer(ref: ContainerRef): Promise<ContainerRef> {
    try {
      const container = this.docker.getContainer(ref.name);
      await container.remove({ force: true, v: true, abortSignal: this.abortSignal });
    } catch (e) {
      if ('statusCode' in e && e.statusCode === 409) {
        return ref;
      }
      this.warn('Unable to remove container', { cause: e });
      throw new Error('Unable to remove container', { cause: e });
    }

    return ref;
  }

  private get mounts(): Promise<Dockerode.MountSettings[]> {
    const { src, ignoreFilter, generatedFiles } = this.gitService.config;

    return this.gitService.workDir.then((cwd) => {
      const mountSettings: Dockerode.MountSettings[] = [];
      const dir = join(cwd, src);
      const files = readdirSync(dir).filter((file) => {
        return ignoreFilter(file);
      });

      files.forEach((file) => {
        const settings: Dockerode.MountSettings = {
          Type: 'bind',
          Source: join(dir, file),
          Target: `/var/task/${file}`,
        };
        mountSettings.push(settings);
      });

      generatedFiles.forEach((file) => {
        const settings: Dockerode.MountSettings = {
          Type: 'volume',
          Source: `${this.imageName.replaceAll(':', '-')}-${file.replaceAll(path.sep, '-')}`,
          Target: `/var/task/${file}`,
        };
        mountSettings.push(settings);
      });

      return mountSettings;
    });
  }
}
