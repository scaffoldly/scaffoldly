import { AbortEvent, AsyncResponse, RuntimeEvent } from './types';
import { AsyncSubject, catchError, Observable, of, Subject, switchMap } from 'rxjs';
import type { OperatorFunction } from 'rxjs';
import { Routes } from '../config';
import { asyncResponse$ } from './observables';
import axios from 'axios';
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
              payload: Readable.from([Buffer.from(err.message)]),
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

            // Prepare the response stream
            const responseStreamWithPrelude = new PassThrough();
            responseStreamWithPrelude.write(JSON.stringify(prelude));
            responseStreamWithPrelude.write(Buffer.alloc(8)); // 8 NULL characters

            // Pipe the response payload into the stream
            payload.on('data', (chunk) => {
              responseStreamWithPrelude.write(chunk);
            });

            // Handle errors in the payload stream
            payload.on('error', (err) => {
              console.error('Payload stream error:', err);
              responseStreamWithPrelude.write('\r\n'); // End the body
              responseStreamWithPrelude.write(
                `Lambda-Runtime-Function-Error-Type: stream.error\r\n`,
              );
              responseStreamWithPrelude.write(
                `Lambda-Runtime-Function-Error-Body: ${Buffer.from(err.message).toString(
                  'base64',
                )}\r\n`,
              );
              responseStreamWithPrelude.write('\r\n');
              responseStreamWithPrelude.end();
            });

            // Finalize the stream
            payload.on('end', () => {
              responseStreamWithPrelude.write('\r\n\r\n'); // End chunked transfer
              responseStreamWithPrelude.end();
            });

            await axios.post(
              `http://${runtimeApi}/2018-06-01/runtime/invocation/${requestId}/response`,
              responseStreamWithPrelude,
              {
                headers: {
                  'Content-Type': 'application/vnd.awslambda.http-integration-response',
                  'Lambda-Runtime-Function-Response-Mode': 'streaming',
                  'Transfer-Encoding': 'chunked',
                  Trailer: [
                    'Lambda-Runtime-Function-Error-Type',
                    'Lambda-Runtime-Function-Error-Body',
                  ],
                },
                signal: abortEvent.signal,
                maxBodyLength: 20 * 1024 * 1024, // 20 MiB
                onUploadProgress: (progress) => {
                  log('Stream progress', { requestId, progress });
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
