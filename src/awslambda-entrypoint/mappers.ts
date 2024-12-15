import { AbortEvent, AsyncResponse, RuntimeEvent, SyncPrelude } from './types';
import { AsyncSubject, catchError, Observable, of, Subject, switchMap } from 'rxjs';
import type { OperatorFunction } from 'rxjs';
import { Routes } from '../config';
import { asyncResponse$ } from './observables';
import axios, { AxiosHeaders } from 'axios';
import { PassThrough, Readable } from 'stream';
import { log } from './log';

export const mapError = (
  runtimeEvent: RuntimeEvent,
): OperatorFunction<AsyncResponse, AsyncResponse> => {
  return (source: Observable<AsyncResponse>): Observable<AsyncResponse> => {
    return new Observable<AsyncResponse>((subscriber) => {
      const subscription = source
        .pipe(
          catchError((err) => {
            const asyncResponse: AsyncResponse = {
              requestId: runtimeEvent.requestId,
              prelude: {
                // TODO: for DDB events, etc,
                //        we need to emit a proper lambda error (instead of 500's)
                statusCode: 500,
                headers: {
                  // TODO: respect content type on request
                  'Content-Type': 'text/plain',
                  'access-control-allow-origin': '*',
                  'access-control-allow-methods': '*',
                },
              },
              payload: Promise.resolve(Buffer.from(err.message)),
              response$: runtimeEvent.response$,
              completed$: runtimeEvent.completed$,
            };
            return of(asyncResponse);
          }),
        )
        .subscribe({
          next(asyncResponse) {
            subscriber.next(asyncResponse);
          },
          error(err) {
            subscriber.error(err);
          },
          complete() {
            subscriber.complete();
          },
        });

      return () => {
        subscription.unsubscribe();
      };
    });
  };
};

export const mapRuntimeEvent = (
  abortEvent: AbortEvent,
  routes: Routes,
): OperatorFunction<RuntimeEvent, AsyncResponse> => {
  return (source: Observable<RuntimeEvent>): Observable<AsyncResponse> => {
    return new Observable<AsyncResponse>((subscriber) => {
      // Subscribe to the source observable
      const subscription = source
        .pipe(
          switchMap((runtimeEvent) =>
            asyncResponse$(abortEvent, runtimeEvent, routes).pipe(mapError(runtimeEvent)),
          ),
        )
        .subscribe({
          next(asyncResponse) {
            asyncResponse.response$.next(asyncResponse);
            subscriber.next(asyncResponse);
          },
          error(err) {
            subscriber.error(err);
          },
          complete() {
            subscriber.complete();
          },
        });

      // Return the teardown logic
      return () => {
        subscription.unsubscribe();
      };
    });
  };
};

export const mapResponse = (
  abortEvent: AbortEvent,
  runtimeApi: string,
  requestId: string,
  response$: AsyncSubject<AsyncResponse>,
  completed$: Subject<AsyncResponse>,
): OperatorFunction<AsyncResponse, AsyncResponse> => {
  return (source: Observable<AsyncResponse>): Observable<AsyncResponse> => {
    return new Observable<AsyncResponse>((subscriber) => {
      const subscription = source
        .pipe(
          switchMap(async (asyncResponse) => {
            const { prelude, payload } = asyncResponse;

            const headers: AxiosHeaders = new AxiosHeaders();
            headers.set('Content-Type', 'application/json');

            let body: Readable | SyncPrelude | undefined = undefined;

            if (payload instanceof Promise) {
              body = {
                statusCode: prelude.statusCode,
                headers: prelude.headers,
                cookies: prelude.cookies,
                body: (await payload).toString('base64'),
                isBase64Encoded: true,
              };
            } else {
              const data = new PassThrough();
              body = data;

              headers.set('Content-Type', 'application/vnd.awslambda.http-integration-response');
              headers.set('Lambda-Runtime-Function-Response-Mode', 'streaming');
              headers.set('Transfer-Encoding', 'chunked');
              headers.set('Trailer', [
                'Lambda-Runtime-Function-Error-Type',
                'Lambda-Runtime-Function-Error-Body',
              ]);

              data.write(JSON.stringify(prelude));
              data.write(Buffer.alloc(8)); // 8 NULL characters

              let bytes = 0;

              payload.on('data', (chunk) => {
                bytes += chunk.length;
                data.write(chunk);
              });

              payload.on('error', (err) => {
                console.error('Payload stream error:', err);
                data.write('\r\n'); // End the body
                data.write(`Lambda-Runtime-Function-Error-Type: stream.error\r\n`);
                data.write(
                  `Lambda-Runtime-Function-Error-Body: ${Buffer.from(err.message).toString(
                    'base64',
                  )}\r\n`,
                );
                data.write('\r\n');
                data.end();
              });

              payload.on('end', () => {
                if (bytes === 0) {
                  data.write('\0');
                }
                data.end();
              });
            }

            const maxBodyLength = Buffer.isBuffer(payload) ? 6 * 1024 * 1024 : 20 * 1024 * 1024;

            await axios.post(
              `http://${runtimeApi}/2018-06-01/runtime/invocation/${requestId}/response`,
              body,
              {
                headers,
                signal: abortEvent.signal,
                maxBodyLength,
                onUploadProgress: (progress) => {
                  log('Progress', { requestId, progress });
                },
              },
            );

            return {
              ...asyncResponse,
              response$,
              completed$,
            };
          }),
        )
        .subscribe({
          next(asyncResponse) {
            subscriber.next(asyncResponse);
          },
          error(err) {
            subscriber.error(err);
          },
          complete() {
            subscriber.complete();
          },
        });

      return () => {
        subscription.unsubscribe();
      };
    });
  };
};

export const mapAsyncResponse = (
  abortEvent: AbortEvent,
  runtimeApi: string,
  requestId: string,
  response$: AsyncSubject<AsyncResponse>,
  completed$: Subject<AsyncResponse>,
): OperatorFunction<AsyncResponse, AsyncResponse> => {
  return (source: Observable<AsyncResponse>): Observable<AsyncResponse> => {
    return new Observable<AsyncResponse>((subscriber) => {
      // Subscribe to the source observable
      const subscription = source
        .pipe(mapResponse(abortEvent, runtimeApi, requestId, response$, completed$))
        .subscribe({
          next(response) {
            subscriber.next(response);
          },
          error(err) {
            subscriber.error(err);
          },
          complete() {
            subscriber.complete();
          },
        });

      // Return the teardown logic
      return () => {
        subscription.unsubscribe();
      };
    });
  };
};
