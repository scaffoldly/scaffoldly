import { BehaviorSubject, Observable, filter } from 'rxjs';

export type Lifecycle = 'started' | 'stopped';

export type ServerStatus = {
  name: string;
  lifecycle?: Lifecycle;
  lifecycle$: Observable<Lifecycle>;
};

export abstract class DevServer {
  private _lifecycle$ = new BehaviorSubject<Lifecycle | undefined>(undefined);

  constructor(public readonly name: string, public readonly abortController: AbortController) {
    this.abortController.signal.addEventListener('abort', async () => {
      console.log(`${this.name} Server is shutting down...`);
      await this.dispose();
    });
  }

  async get(): Promise<ServerStatus> {
    return {
      name: this.name,
      lifecycle: this._lifecycle$.value,
      lifecycle$: this._lifecycle$.pipe(filter((l) => !!l)),
    };
  }

  async create(): Promise<void> {
    await this.start();
    this._lifecycle$.next('started');
  }

  async dispose(): Promise<void> {
    // TODO: use cloud resource disposal
    await this.stop();
    this._lifecycle$.next('stopped');
  }

  protected abstract start(): Promise<void>;

  protected abstract stop(): Promise<void>;
}
