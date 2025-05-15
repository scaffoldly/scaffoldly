import { ChildProcess } from 'child_process';
import { AsyncSubject, Subject } from 'rxjs';
import { error, log } from './log';
import { Readable } from 'stream';
import { Stdio } from '../config';

export type SpawnResult = {
  childProcess?: ChildProcess;
  handler: string;
};

export type AsyncPrelude = {
  statusCode?: number;
  headers?: Record<string, unknown>;
  cookies?: string[];
};

export type SyncPrelude = AsyncPrelude & {
  body: string;
  isBase64Encoded: true;
};

export type AsyncResponse = {
  requestId?: string;
  prelude: AsyncPrelude;
  payload: Readable | Promise<Buffer>;
  response$: AsyncSubject<AsyncResponse>;
  completed$: Subject<AsyncResponse>;
};

export type RuntimeEvent = {
  runtimeApi: string;
  requestId: string;
  headers: Record<string, unknown>;
  event: string;
  deadline: number;
  env: Record<string, string>;
  stdio: Stdio;
  response$: AsyncSubject<AsyncResponse>;
  completed$: Subject<AsyncResponse>;
};

type AbortReason = {
  requestId?: string;
  reason: unknown;
};

export class AbortEvent extends AbortController {
  constructor() {
    super();

    this.signal.addEventListener('abort', () => {
      const reason = this.signal.reason as AbortReason;
      const { reason: abortReason } = reason;
      const message = abortReason instanceof Error ? abortReason.message : `${abortReason}`;

      process.nextTick(() => {
        error(`ABORTING: ${message}`);
        log(`ABORT Reason:`, reason);
        process.exit(-1);
      });
    });
  }

  abort(reason: unknown): void {
    super.abort({ reason } as AbortReason);
  }
}
