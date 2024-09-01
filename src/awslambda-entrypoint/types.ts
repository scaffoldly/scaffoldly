import { ChildProcess } from 'child_process';
import { AsyncSubject } from 'rxjs';
import { error, log } from './log';

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
};

export type RuntimeEvent = {
  requestId: string;
  event: string;
  deadline: number;
  env: Record<string, string>;
  response$: AsyncSubject<AsyncResponse>;
};

export class AbortEvent extends AbortController {
  private response$?: AsyncSubject<AsyncResponse>;

  constructor() {
    super();

    this.signal.onabort = () => {
      const { reason } = this.signal;
      const message = reason instanceof Error ? reason.message : reason;

      log('Aborting!', { reason });

      const payload: AsyncPayload = {
        statusCode: 500,
        body: JSON.stringify({ error: message }),
        headers: {
          'Content-Type': 'application/json',
        },
        isBase64Encoded: false,
      };

      let { response$ } = this;
      if (!response$) {
        response$ = new AsyncSubject<AsyncResponse>();
        response$.next({ payload, response$ });
      }

      response$.subscribe((response) => {
        error(`ABORTED: ${message}`, { requestId: response.requestId });
        process.exit(-1);
      });

      response$.complete();
    };
  }

  abortResponse(response$: AsyncSubject<AsyncResponse>, reason: unknown): void {
    this.response$ = response$;
    this.abort(reason);
  }
}
