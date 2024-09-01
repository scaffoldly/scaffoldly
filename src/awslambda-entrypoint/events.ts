import axios from 'axios';
import { error, log } from './log';
import { AsyncPayload, AsyncResponse, RuntimeEvent } from './types';
import { AsyncSubject, catchError, from, map, Observable, throwError } from 'rxjs';

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
        response$.next({ payload });
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

export const nextEvent$ = (
  abortEvent: AbortEvent,
  runtimeApi: string,
): Observable<RuntimeEvent> => {
  return from(
    Promise.resolve()
      .then(() => {
        log('Awaiting next event', { runtimeApi });
      })
      .then(() => {
        return axios.get(`http://${runtimeApi}/2018-06-01/runtime/invocation/next`, {
          responseType: 'text',
          signal: abortEvent.signal,
        });
      }),
  ).pipe(
    catchError((e) => {
      abortEvent.abort(e);
      return throwError(() => new Error('Unable to fetch next event', { cause: e }));
    }),
    map((next) => {
      log('Received next event', { headers: next.headers });

      const response$ = new AsyncSubject<AsyncResponse>();
      response$.subscribe((response) => {
        const url = `http://${runtimeApi}/2018-06-01/runtime/invocation/${response.requestId}/response`;
        axios
          .post(url, response.payload)
          .then((r) => {
            log('Response sent to Lambda Runtime API', { url, statusCode: r.status });
          })
          .catch((e) => {
            error('Error sending event response', { cause: e });
          });
      });

      return {
        requestId: next.headers['lambda-runtime-aws-request-id'],
        event: next.data,
        deadline: Number.parseInt(next.headers['lambda-runtime-deadline-ms']),
        response$,
      };
    }),
  );
};
