import Dockerode from 'dockerode';
import { BehaviorSubject, delay, of, Subject, Subscription, switchMap } from 'rxjs';
import { DockerService } from '.';
import { GitService } from '../../cd/git';
import { EnvService } from '../env';
import { RUNTIME_SERVER_PORT } from '../aws/lambda/lambda-runtime-server';
import { uniqueId } from 'lodash';
import { DevServer, Lifecycle } from '../server/dev-server';

export type ContainerRef = {
  name: string;
  runtimeApi: string;
  lifecycle$: BehaviorSubject<Lifecycle>;
};

class ContainerRefSubject extends Subject<ContainerRef> {
  constructor(private delayTime: number) {
    super();
  }

  next(containerRef: ContainerRef): void {
    console.log('!!! next', containerRef);
    containerRef.lifecycle$
      .pipe(
        switchMap((status) => {
          if (status === 'stopped') {
            return of(containerRef); // Emit immediately if stopped
          } else {
            console.log('!!! Delaying', containerRef);
            return of(containerRef).pipe(delay(this.delayTime)); // Apply delay if started
          }
        }),
      )
      .subscribe((ref) => super.next(ref))
      .unsubscribe();
  }
}

export type ContainerPoolMap = Map<string, ContainerRef>;

export class ContainerPool extends DevServer {
  protected readonly docker: Dockerode;

  private _imageName?: string;

  private pool: ContainerPoolMap = new Map();

  private pending$: ContainerRefSubject;

  private started$: ContainerRefSubject;

  private starting$: ContainerRefSubject;

  private garbage$: ContainerRefSubject;

  private deleted$: ContainerRefSubject;

  private subscriptions: Subscription[] = [];

  private concurrency$: BehaviorSubject<{ current: number; desired: number; max: number }> =
    new BehaviorSubject({ current: 0, desired: 0, max: 0 });

  // private memory = 1024; // TODO

  constructor(
    abortController: AbortController,
    private gitService: GitService,
    dockerService: DockerService,
    private envService: EnvService,
    protected readonly options = { lifetime: 300 },
  ) {
    super('Container Pool', abortController);
    this.docker = dockerService.docker;
    this.pending$ = new ContainerRefSubject(1000);
    this.starting$ = new ContainerRefSubject(1000);
    this.started$ = new ContainerRefSubject(1000);
    this.garbage$ = new ContainerRefSubject(options.lifetime * 1000);
    this.deleted$ = new ContainerRefSubject(1000);

    this.subscriptions.push(
      this.concurrency$.subscribe(({ current, desired, max }) => {
        console.log('!!! Concurrency:', { current, desired, max });
        if (current < desired) {
          const containerRef: ContainerRef = {
            name: uniqueId(this.gitService.config.name),
            runtimeApi: `host.docker.internal:${RUNTIME_SERVER_PORT}`,
            lifecycle$: new BehaviorSubject<Lifecycle>('stopped'),
          };

          this.pool.set(containerRef.name, containerRef);

          // Start one at a time
          this.pending$.next(containerRef);

          // containerRef.lifecycle$.subscribe(() => {
          //   const count = this.pool.size;
          //   this.concurrency$.next({ current: count, desired, max });
          // });
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

  setConcurrency(
    desired = this.concurrency$.value.desired,
    max = this.concurrency$.value.max,
  ): void {
    const current = this.pool.size;
    desired = Math.min(desired, max);
    if (current !== desired) {
      this.concurrency$.next({ current, desired, max });
    }
  }

  async start(): Promise<void> {
    console.log('!!! Starting container pool');
    this.subscriptions.push(
      this.pending$.subscribe(async (containerRef) => {
        console.log('!!! Pending container', containerRef);
        await this.createContainer(containerRef)
          .then(() => this.starting$.next(containerRef))
          .catch(() => this.garbage$.next(containerRef));
      }),
      this.starting$.subscribe(async (containerRef) => {
        console.log('!!! Starting container', containerRef);
        await this.startContainer(containerRef)
          .then(() => this.started$.next(containerRef))
          .catch(() => this.garbage$.next(containerRef));
      }),
      this.started$.subscribe(async (containerRef) => {
        console.log('!!! Started container', containerRef);
        containerRef.lifecycle$.next('started');
      }),
      this.garbage$.subscribe(async (containerRef) => {
        console.log('!!! Garbage collecting container', containerRef);
        await this.removeContainer(containerRef)
          .then(() => this.deleted$.next(containerRef))
          .catch(() => this.deleted$.next(containerRef));
      }),
      this.deleted$.subscribe(async (containerRef) => {
        console.log('!!! Deleting container', containerRef);
        this.pool.delete(containerRef.name);
      }),
    );
  }

  async stop(): Promise<void> {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  private async createContainer(ref: ContainerRef): Promise<ContainerRef> {
    try {
      const env = this.envService.dockerEnv;
      env.unshift(`AWS_LAMBDA_RUNTIME_API=${ref.runtimeApi}`);
      env.unshift(`SLY_DEBUG=1`);

      await this.docker.createContainer({
        name: ref.name,
        Image: this.imageName,
        AttachStderr: false, // TODO: Capture output
        AttachStdout: false, // TODO: Capture output
        AttachStdin: false,
        Tty: false,
        Env: env,
        Cmd: [], // TODO
        Entrypoint: ['.entrypoint'],
        HostConfig: {
          NetworkMode: 'host',
          AutoRemove: true,
          Mounts: [], // TODO
          // Memory: 1024 * 1024 * 1024, // TODO
        },
        abortSignal: this.abortController.signal,
      });

      return ref;
    } catch (e) {
      console.log("!!! Couldn't create container", e);
      throw new Error('Unable to create container', { cause: e });
    }
  }

  private async startContainer(ref: ContainerRef): Promise<ContainerRef> {
    try {
      const container = this.docker.getContainer(ref.name);
      await container.start({ abortSignal: this.abortController.signal });
    } catch (e) {
      throw new Error('Unable to start container', { cause: e });
    }

    return ref;
  }

  private async removeContainer(ref: ContainerRef): Promise<ContainerRef> {
    try {
      const container = this.docker.getContainer(ref.name);
      const inspection = await container.inspect().catch(() => undefined);
      if (!inspection) {
        return ref;
      }
      await container.remove({ force: true });
      return ref;
    } catch (e) {
      throw new Error('Unable to remove container', { cause: e });
    }
  }
}
