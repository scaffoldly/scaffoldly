import { ChildProcess } from 'child_process';
import { AsyncSubject } from 'rxjs';
import { error } from './log';

export type SpawnResult = {
  childProcess?: ChildProcess;
  handler: string;
};

export type AsyncPayload = {
  statusCode: number;
  body: string;
  headers: Record<string, unknown>;
  isBase64Encoded: boolean;
};

export type AsyncResponse = {
  requestId?: string;
  payload: AsyncPayload;
  response$: AsyncSubject<AsyncResponse>;
  method?: string;
  url?: string;
};

export type RuntimeEvent = {
  requestId: string;
  event: string;
  deadline: number;
  env: Record<string, string>;
  response$: AsyncSubject<AsyncResponse>;
};

export type RuntimeResponse = {
  url?: string;
  statusCode: number;
  headers: Record<string, unknown>;
};

type AbortReason = {
  requestId?: string;
  reason: unknown;
};

export class AbortEvent extends AbortController {
  constructor() {
    super();

    this.signal.onabort = () => {
      const reason = this.signal.reason as AbortReason;
      const { reason: abortReason } = reason;
      const message = abortReason instanceof Error ? abortReason.message : `${abortReason}`;

      process.nextTick(() => {
        error(`ABORTING: ${message}`);
        process.exit(-1);
      });
    };
  }

  abort(reason: unknown): void {
    super.abort({ reason } as AbortReason);
  }
}
