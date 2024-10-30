import { ChildProcess } from 'child_process';
import { AsyncSubject, Subject } from 'rxjs';
import { error } from './log';
import { Readable } from 'stream';

export type SpawnResult = {
  childProcess?: ChildProcess;
  handler: string;
};

export type AsyncPrelude = {
  statusCode?: number;
  headers?: Record<string, unknown>;
  cookies?: string[];
};

export type AsyncResponse = {
  requestId?: string;
  prelude: AsyncPrelude;
  payload: Readable;
  response$: AsyncSubject<AsyncResponse>;
  completed$: Subject<AsyncResponse>;
  method?: string;
  url?: string;
  statusCode?: number;
  headers?: Record<string, unknown>;
};

export type RuntimeEvent = {
  requestId: string;
  headers: Record<string, unknown>;
  event: string;
  deadline: number;
  env: Record<string, string>;
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
        process.exit(-1);
      });
    });
  }

  abort(reason: unknown): void {
    super.abort({ reason } as AbortReason);
  }
}
