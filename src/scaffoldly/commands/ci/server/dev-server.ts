import { BehaviorSubject, Observable, filter } from 'rxjs';
import { Writable } from 'stream';
import chalk, {
  // eslint-disable-next-line import/named
  ChalkInstance,
} from 'chalk';

export type Lifecycle = 'started' | 'stopped';

export type ServerStatus = {
  name: string;
  lifecycle?: Lifecycle;
  lifecycle$: Observable<Lifecycle>;
};

class TimestampedStream extends Writable {
  // eslint-disable-next-line no-control-regex
  ansiRegex = /\u001b\[.*?m/g;

  private outputStream: Writable;

  constructor(outputStream: Writable, private _color: ChalkInstance) {
    super();
    this.outputStream = outputStream;
  }

  log(message: string): void {
    this.write(`${message}\n`);
  }

  color(message: string): string {
    return this.ansiRegex.test(message) ? message : this._color(message);
  }

  _write(
    chunk: Buffer,
    encoding: 'buffer' | BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    let chunkString: string;

    // Handle the case where encoding is "buffer"
    if (encoding === 'buffer') {
      chunkString = chunk.toString(); // Default to 'utf8'
    } else {
      chunkString = chunk.toString(encoding); // Use the provided encoding
    }

    const formattedChunk = this.color(
      chunkString
        .split('\n')
        .map((line) => {
          if (line) {
            return `${new Date().toISOString()}\t${line}`;
          }
          return line;
        })
        .join('\n'),
    );

    // Write the formatted string to the output stream
    this.outputStream.write(formattedChunk, callback);
  }
}

export abstract class DevServer {
  private _lifecycle$ = new BehaviorSubject<Lifecycle | undefined>(undefined);

  private _stdout = new TimestampedStream(process.stdout, chalk.green);

  private _stderr = new TimestampedStream(process.stderr, chalk.yellow);

  constructor(public readonly name: string, public readonly abortController: AbortController) {
    this.abortController.signal.addEventListener('abort', async () => {
      await this.dispose();
    });
  }

  get stdout(): Writable {
    return this._stdout;
  }

  get stderr(): Writable {
    return this._stderr;
  }

  log(message: string): void {
    this._stdout.log(message);
  }

  warn(message: string): void {
    this._stderr.log(message);
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
