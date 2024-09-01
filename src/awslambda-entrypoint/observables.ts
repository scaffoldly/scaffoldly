import {
  AsyncSubject,
  catchError,
  expand,
  from,
  lastValueFrom,
  map,
  Observable,
  of,
  retry,
  switchMap,
  throwError,
  timer,
} from 'rxjs';
import { Commands, CONFIG_SIGNATURE, Routes } from '../config';
import { Socket } from 'net';
import { ALBEvent, APIGatewayProxyEventV2 } from 'aws-lambda';
import { error, info, isDebug, log } from './log';
import {
  convertAlbQueryStringToURLSearchParams,
  findHandler,
  transformAxiosResponseHeaders,
} from './util';
import { AbortEvent, AsyncResponse, RuntimeEvent } from './types';
import axios from 'axios';
import { execa } from 'execa';
import { mapRuntimeEvent } from './mappers';

const next$ = (
  abortEvent: AbortEvent,
  runtimeApi: string,
  env: Record<string, string>,
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
      log('Received next event', { headers: next.headers, data: next.data });

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
        env,
        response$,
      };
    }),
  );
};

const endpoint$ = (handler: string, deadline: number): Observable<URL> => {
  return new Observable<URL>((subscriber) => {
    const now = Date.now();

    const endpoint = new URL(`http://${handler}`);

    const hostname = endpoint.hostname;
    const port = parseInt(endpoint.port, 10) || (endpoint.protocol === 'https:' ? 443 : 80);

    const socket = new Socket();

    const onError = () => {
      socket.destroy();
      subscriber.error(new Error(`Error connecting to ${hostname}:${port}`));
    };

    socket.setTimeout(deadline - now);

    socket.once('error', onError);
    socket.once('timeout', onError);

    socket.connect(port, hostname, () => {
      info(`Connected to ${hostname}:${port}`);
      socket.end();
      subscriber.next(endpoint);
      subscriber.complete();
    });
  }).pipe(
    retry({
      delay: (e) => {
        const now = Date.now();
        if (now > deadline) {
          return throwError(() => new Error(`Deadline exceeded`, { cause: e }));
        } else {
          return timer(1); // Retry after 1ms
        }
      },
    }),
  );
};

const shell$ = (
  abortEvent: AbortEvent,
  runtimeEvent: RuntimeEvent,
  rawEvent: string,
  env: Record<string, string>,
): Observable<AsyncResponse> => {
  const commands = Commands.decode(rawEvent);
  const command = commands.toString();

  return from(
    execa(command, {
      shell: true,
      env: { ...process.env, ...env },
      verbose: isDebug,
      all: true,
      signal: abortEvent.signal,
    }),
  ).pipe(
    catchError((e) => {
      return throwError(() => new Error(`Error executing \`${command}\`: ${e.all}`));
    }),
    map((output) => {
      return {
        requestId: runtimeEvent.requestId,
        response$: runtimeEvent.response$,
        payload: {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(output.all),
          isBase64Encoded: false,
        },
      };
    }),
  );
};

const proxy$ = (
  abortEvent: AbortEvent,
  runtimeEvent: RuntimeEvent,
  url?: string,
  method?: string,
  headers?: {
    [name: string]: string | undefined;
  },
  data?: unknown,
  deadline?: number,
): Observable<AsyncResponse> => {
  return from(
    Promise.resolve()
      .then(() => {
        info('Proxy request', { method, url });
        log('Proxying request', { headers, data, deadline });
      })
      .then(() => {
        return axios.request({
          method,
          url,
          headers,
          data,
          timeout: deadline ? deadline - Date.now() : undefined,
          transformRequest: (req) => req,
          transformResponse: (res) => res,
          validateStatus: () => true,
          responseType: 'arraybuffer',
          signal: abortEvent.signal,
        });
      }),
  ).pipe(
    catchError((e) => {
      return throwError(() => new Error('Unable proxy request', { cause: e }));
    }),
    map((resp) => {
      info('Proxy response', { method, url, status: resp.status });
      log('Proxied response', { headers: resp.headers });

      const { data: responseData, headers: responseHeaders } = resp;

      if (!Buffer.isBuffer(responseData)) {
        throw new Error(`Response from ${url} is not a buffer`);
      }

      // TODO: cookie headers
      return {
        requestId: runtimeEvent.requestId,
        response$: runtimeEvent.response$,
        payload: {
          statusCode: resp.status,
          headers: transformAxiosResponseHeaders(responseHeaders),
          body: Buffer.from(responseData).toString('base64'),
          isBase64Encoded: true,
        },
      };
    }),
  );
};

export const asyncResponse$ = (
  abortEvent: AbortEvent,
  runtimeEvent: RuntimeEvent,
  routes: Routes,
): Observable<AsyncResponse> => {
  const rawEvent = JSON.parse(runtimeEvent.event) as Partial<
    APIGatewayProxyEventV2 | ALBEvent | string
  >;
  const deadline = runtimeEvent.deadline - 1000; // Subtract 1 second to allow errors to propagate

  if (typeof rawEvent === 'string' && rawEvent.startsWith(`${CONFIG_SIGNATURE}@`)) {
    return shell$(abortEvent, runtimeEvent, rawEvent, runtimeEvent.env);
  }

  if (typeof rawEvent !== 'object' || !('requestContext' in rawEvent)) {
    throw new Error('Invalid event'); // TODO Maybe an error observable
  }

  const { requestContext, headers: rawHeaders, body: rawBody, isBase64Encoded } = rawEvent;

  if (!requestContext) {
    throw new Error('Invalid request context');
  }

  let method: string | undefined = undefined;
  if ('http' in requestContext) {
    method = requestContext.http.method;
  }
  if ('elb' in requestContext && 'httpMethod' in rawEvent) {
    method = rawEvent.httpMethod;
  }

  let rawPath: string | undefined = undefined;
  if ('http' in requestContext) {
    rawPath = requestContext.http.path;
  }
  if ('elb' in requestContext && 'path' in rawEvent) {
    rawPath = rawEvent.path;
  }

  let urlSearchParams: URLSearchParams | undefined = undefined;
  if ('http' in requestContext && 'rawQueryString' in rawEvent) {
    urlSearchParams = new URLSearchParams(rawEvent.rawQueryString);
  }
  if ('elb' in requestContext && 'queryStringParameters' in rawEvent) {
    urlSearchParams = convertAlbQueryStringToURLSearchParams(rawEvent.queryStringParameters);
  }

  const handler = findHandler(routes, rawPath);
  if (!handler) {
    throw new Error('No handler found');
  }

  const decodedBody = isBase64Encoded && rawBody ? Buffer.from(rawBody, 'base64') : rawBody;

  return endpoint$(handler, deadline).pipe(
    switchMap((url) => {
      if (rawPath) {
        url.pathname = rawPath;
      }
      if (urlSearchParams) {
        url.search = urlSearchParams.toString();
      }
      return proxy$(
        abortEvent,
        runtimeEvent,
        url.toString(),
        method,
        rawHeaders,
        decodedBody,
        deadline,
      );
    }),
  );
};

export const poll = (
  abortEvent: AbortEvent,
  runtimeApi: string,
  routes: Routes,
  env: Record<string, string>,
): Promise<void> => {
  const poll$ = (): Observable<void> => {
    return next$(abortEvent, runtimeApi, env)
      .pipe(mapRuntimeEvent(abortEvent, routes))
      .pipe(
        switchMap((asyncResponse) => {
          return of(asyncResponse.response$.complete());
        }),
      );
  };

  return lastValueFrom(poll$().pipe(expand(() => poll$())));
};
