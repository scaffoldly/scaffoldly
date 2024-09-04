import {
  AsyncSubject,
  catchError,
  defer,
  expand,
  from,
  lastValueFrom,
  map,
  Observable,
  of,
  retry,
  Subject,
  switchMap,
  throwError,
  timer,
} from 'rxjs';
import { Commands, CONFIG_SIGNATURE, Routes } from '../config';
import { ALBEvent, APIGatewayProxyEventV2 } from 'aws-lambda';
import { error, info, isDebug, log } from './log';
import {
  convertAlbQueryStringToURLSearchParams,
  findHandler,
  transformAxiosResponseHeaders,
} from './util';
import { AbortEvent, AsyncPrelude, AsyncResponse, RuntimeEvent } from './types';
import axios, { isAxiosError } from 'axios';
import { execa } from 'execa';
import { mapAsyncResponse, mapRuntimeEvent } from './mappers';
import { isReadableStream } from 'is-stream';
import { Readable } from 'stream';

const next$ = (
  abortEvent: AbortEvent,
  runtimeApi: string,
  env: Record<string, string>,
): Observable<RuntimeEvent> => {
  return defer(() => {
    log('Fetching next event', { runtimeApi });
    return axios.get(`http://${runtimeApi}/2018-06-01/runtime/invocation/next`, {
      responseType: 'text',
      signal: abortEvent.signal,
      timeout: 0,
    });
  }).pipe(
    retry({
      delay: (e) => {
        if (!isAxiosError(e)) {
          return throwError(() => new Error(`Unknown error`, { cause: e }));
        }

        abortEvent.abort(
          new Error(
            `Error fetching next event: ${e.response?.data || e.response?.statusText || e.code}`,
            {
              cause: e,
            },
          ),
        );

        return timer(1000); // Will be aborted on next cycle
      },
    }),
    map((next) => {
      log('Received next event', { headers: next.headers, data: next.data });

      const requestId = next.headers['lambda-runtime-aws-request-id'];
      const response$ = new AsyncSubject<AsyncResponse>();
      const completed$ = new Subject<AsyncResponse>();

      response$.pipe(mapAsyncResponse(abortEvent, runtimeApi)).subscribe((response) => {
        log('Response sent to Runtime API', { requestId });
        completed$.next(response);
      });

      return {
        requestId,
        event: next.data,
        deadline: Number.parseInt(next.headers['lambda-runtime-deadline-ms']),
        env,
        response$,
        completed$,
      };
    }),
  );
};

const endpoint$ = (handler: string, deadline: number): Observable<URL> => {
  // TODO: We can do some preflight checks here if necessary
  if (Date.now() > deadline) {
    return throwError(() => new Error(`Deadline exceeded`));
  }
  return of(new URL(`http://${handler}`));
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
        completed$: runtimeEvent.completed$,
        prelude: {
          statusCode: 200,
          headers: {
            'Content-Type': 'text/plain',
          },
        },
        payload: Readable.from(output.all || ''),
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
  info('Proxy request', { method, url });
  log('Proxying request', { headers, data, deadline });

  return defer(() => {
    return axios.request({
      method,
      url,
      headers,
      data,
      timeout: deadline ? deadline - Date.now() : undefined,
      transformRequest: (req) => req,
      transformResponse: (res) => res,
      validateStatus: () => true,
      responseType: 'stream',
      signal: abortEvent.signal,
    });
  }).pipe(
    retry({
      delay: (e) => {
        if (!isAxiosError(e)) {
          return throwError(() => new Error(`Unknown error`, { cause: e }));
        }

        if (!deadline || Date.now() > deadline) {
          return throwError(() => new Error(`Deadline exceeded: ${e.code}`, { cause: e }));
        } else if (e.code === 'ECONNREFUSED') {
          return timer(100); // Retry after 100ms (likely cold start)
        }

        error(`Unexpected axios error: ${e}`);
        return throwError(() => new Error(`Error proxying request: ${e.code}`, { cause: e }));
      },
    }),
    map((resp) => {
      info('Proxy response', { method, url, status: resp.status });
      log('Proxied response', { headers: resp.headers });

      const { data: responseData, headers: responseHeaders } = resp;

      if (!isReadableStream(responseData)) {
        throw new Error(`Response from ${method} ${url} was not a stream`);
      }

      // TODO: cookie headers
      const prelude: AsyncPrelude = {
        statusCode: resp.status,
        headers: transformAxiosResponseHeaders(responseHeaders),
      };

      return {
        requestId: runtimeEvent.requestId,
        response$: runtimeEvent.response$,
        completed$: runtimeEvent.completed$,
        method,
        url,
        prelude,
        payload: responseData,
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
          asyncResponse.response$.complete();
          return asyncResponse.completed$;
        }),
        switchMap(() => {
          return of(undefined);
        }),
      );
  };

  return lastValueFrom(poll$().pipe(expand(() => poll$())));
};
