import { AbortEvent, AsyncResponse, RuntimeEvent } from './types';
import {
  Observable,
  // eslint-disable-next-line import/named
  OperatorFunction,
  switchMap,
} from 'rxjs';
import { Routes } from '../config';
import { asyncResponse$ } from './observables';

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
