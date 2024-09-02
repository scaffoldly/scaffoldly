import { AbortEvent, AsyncResponse, RuntimeEvent, RuntimeResponse } from './types';
import {
  catchError,
  from,
  Observable,
  // eslint-disable-next-line import/named
  OperatorFunction,
  switchMap,
  throwError,
} from 'rxjs';
import { Routes } from '../config';
import { asyncResponse$ } from './observables';
import axios, { isAxiosError } from 'axios';

export const mapRuntimeEvent = (
  abortEvent: AbortEvent,
  routes: Routes,
): OperatorFunction<RuntimeEvent, AsyncResponse> => {
  return (source: Observable<RuntimeEvent>): Observable<AsyncResponse> => {
    return new Observable<AsyncResponse>((subscriber) => {
      // Subscribe to the source observable
      const subscription = source
        .pipe(switchMap((runtimeEvent) => asyncResponse$(abortEvent, runtimeEvent, routes)))
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

export const mapAsyncResponse = (
  abortEvent: AbortEvent,
  runtimeApi: string,
): OperatorFunction<AsyncResponse, RuntimeResponse> => {
  return (source: Observable<AsyncResponse>): Observable<RuntimeResponse> => {
    return new Observable<RuntimeResponse>((subscriber) => {
      // Subscribe to the source observable
      const subscription = source
        .pipe(
          switchMap((asyncResponse) => {
            return from(
              axios.post(
                `http://${runtimeApi}/2018-06-01/runtime/invocation/${asyncResponse.requestId}/response`,
                asyncResponse.payload,
                { signal: abortEvent.signal },
              ),
            ).pipe(
              catchError((e) => {
                if (!isAxiosError(e)) {
                  return throwError(() => new Error(`Unknown error`, { cause: e }));
                }

                let message = e.response?.statusText || e.message;
                if (asyncResponse.method && asyncResponse.url) {
                  message = `Unable to ${asyncResponse.method} ${asyncResponse.url}: ${message}`;
                }

                return from(
                  axios.post(
                    `http://${runtimeApi}/2018-06-01/runtime/invocation/${asyncResponse.requestId}/response`,
                    {
                      statusCode: 500,
                      body: `${message}\n`,
                      headers: {
                        'Content-Type': 'text/plain',
                      },
                      isBase64Encoded: false,
                    },
                    { signal: abortEvent.signal },
                  ),
                );
              }),
            );
          }),
        )
        .subscribe({
          next(axiosResponse) {
            subscriber.next({
              url: axiosResponse.config.url,
              headers: axiosResponse.headers,
              statusCode: axiosResponse.status,
            });
          },
          error(err) {
            abortEvent.abort(err);
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
