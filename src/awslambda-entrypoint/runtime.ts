import { RuntimeEvent } from './types';
import {
  Observable,
  // eslint-disable-next-line import/named
  OperatorFunction,
} from 'rxjs';
import { Routes } from '../config';
import { AbortEvent } from './events';

// export const mapPath =
//   (routes: Routes): OperatorFunction<RuntimeEvent, RuntimeEventWithPath> =>
//   (source) => {
//     return new Observable((subscriber) => {
//       const subscription = source.subscribe({
//         next: (runtimeEvent) => {
//           return {
//             ...runtimeEvent,
//             path: 'todo',
//           } as RuntimeEventWithPath;
//         },
//         error: (err) => {
//           subscriber.error(err);
//         },
//         complete: () => {
//           subscriber.complete();
//         },
//       });

//       return () => {
//         subscription.unsubscribe();
//       };
//     });
//   };

export const mapRuntimeEvent = (
  abortEvent: AbortEvent,
  routes: Routes,
): OperatorFunction<RuntimeEvent, RuntimeEvent> => {
  return (source: Observable<RuntimeEvent>): Observable<RuntimeEvent> => {
    return new Observable<RuntimeEvent>((subscriber) => {
      // Subscribe to the source observable
      const subscription = source.subscribe({
        next(runtimeEvent) {
          console.log('!!! runtimeEvent', runtimeEvent);
          console.log('!!! routes', routes);
          console.log('!!! abortEvent', abortEvent);

          runtimeEvent.response$.next({
            requestId: runtimeEvent.requestId,
            payload: {
              statusCode: 200,
              body: 'Hello, World!',
              headers: {},
              isBase64Encoded: false,
            },
          });

          console.log('!!! completing response$');
          runtimeEvent.response$.complete();
          console.log('!!! calling next');
          subscriber.next(runtimeEvent);
        },
        error(err) {
          // Forward any errors
          subscriber.error(err);
        },
        complete() {
          // Complete the observable
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

// export const mapRuntimeEvent =
//   (abortEvent: AbortEvent, routes: Routes): OperatorFunction<RuntimeEvent, void> =>
//   (source) => {
//     return new Observable((subscriber) => {
//       console.log('!!! subscribing');
//       const subscription = source.subscribe({
//         next: (runtimeEvent) => {
//           console.log('!!! runtimeEvent', runtimeEvent);
//           console.log('!!! routes', routes);
//           console.log('!!! abortEvent', abortEvent);

//           runtimeEvent.response$.next({
//             requestId: runtimeEvent.requestId,
//             payload: {
//               statusCode: 200,
//               body: 'Hello, World!',
//               headers: {},
//               isBase64Encoded: false,
//             },
//           });

//           console.log('!!! calling next');
//           subscriber.next(runtimeEvent.response$.complete());
//         },
//         error: (err) => {
//           console.log('!!! calling error', err);
//           subscriber.error(err);
//         },
//         complete: () => {
//           console.log('!!! calling complete');
//           subscriber.complete();
//         },
//       });

//       return () => {
//         console.log('!!! unsubscribing');
//         subscription.unsubscribe();
//       };
//     });
//   };

// export const mapEndpoint =
//   (routes: Routes): OperatorFunction<RuntimeEvent, void> =>
//   (source) => {
//     return new Observable((subscriber) => {
//       const subscription = source.subscribe({
//         next: (runtimeEvent) => {
//           return runtimeEvent;
//         },
//         error: (err) => {
//           subscriber.error(err);
//         },
//         complete: () => {
//           subscriber.complete();
//         },
//       });

//       return () => {
//         subscription.unsubscribe();
//       };
//     });
//   };

// const mapToEndpoint =
//   (routes: Routes): OperatorFunction<RuntimeEvent, void> =>
//   (source) => {
//     return new Observable((subscriber) => {
//       const subscription = source.subscribe({
//         next: (runtimeEvent) => {
//           const { requestId, event, response$ } = runtimeEvent;
//           const deadline = runtimeEvent.deadline - 1000; // Subtract 1 second to allow errors to propagate

//           const rawEvent = JSON.parse(event) as Partial<APIGatewayProxyEventV2 | ALBEvent | string>;

//           log('Received event', { rawEvent });
//           const handler = findHandler(routes, rawEvent.rawPath);

//           if (!handler) {
//             error('No handler found', { rawPath: event.rawPath, routes });
//             throw new Error(`No handler found for ${event.rawPath}`);
//           }

//           log('Waiting for endpoint', { handler, routes, deadline });
//           const { endpoint } = await waitForEndpoint(handler, deadline);

//           const url = new URL(event.rawPath, endpoint);
//           if (event.urlSearchParams) {
//             url.search = event.urlSearchParams.toString();
//           }

//           const decodedBody =
//             event.isBase64Encoded && event.rawBody
//               ? Buffer.from(event.rawBody, 'base64')
//               : event.rawBody;
//           const timeout = deadline - Date.now();

//           info('Proxying request', {
//             url,
//             method: event.method,
//             rawHeaders: event.rawHeaders,
//             timeout,
//           });

//           let response: AxiosResponse<unknown, unknown> | undefined = undefined;

//           response = await axios.request({
//             method: event.method.toLowerCase(),
//             url: url.toString(),
//             headers: event.rawHeaders,
//             data: decodedBody,
//             timeout,
//             transformRequest: (data) => data,
//             transformResponse: (data) => data,
//             validateStatus: () => true,
//             responseType: 'arraybuffer',
//           });

//           if (!response) {
//             throw new Error('No response received');
//           }

//           const { data: rawData, headers: rawResponseHeaders } = response;

//           if (!Buffer.isBuffer(rawData)) {
//             throw new Error('Response data is not a buffer');
//           }

//           info('Proxy request complete', { method: event.method, url });

//           response$.next({
//             requestId,
//             payload: {
//               statusCode: response.status,
//               body: rawData.toString('base64'),
//               headers: rawResponseHeaders,
//               isBase64Encoded: true,
//             },
//           });
//           response$.complete();
//         },
//         error: (err) => {
//           subscriber.error(err);
//         },
//         complete: () => {
//           subscriber.complete();
//         },
//       });

//       return () => {
//         subscription.unsubscribe();
//       };
//     });
//   };
