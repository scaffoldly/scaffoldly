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
import { Commands, CONFIG_SIGNATURE, Routes, USER_AGENT } from '../config';
import { ALBEvent, APIGatewayProxyEventV2, DynamoDBStreamEvent, S3Event } from 'aws-lambda';
import { error, info, isDebug, log } from './log';
import {
  convertAlbQueryStringToURLSearchParams,
  findHandler,
  transformAxiosResponseCookies,
  transformAxiosResponseHeaders,
} from './util';
import { AbortEvent, AsyncPrelude, AsyncResponse, RuntimeEvent } from './types';
import axios, { isAxiosError } from 'axios';
import { execa } from 'execa';
import { mapAsyncResponse, mapRuntimeEvent } from './mappers';
import { isReadableStream } from 'is-stream';
import { PassThrough } from 'stream';
import { buffer } from 'stream/consumers';
import { Agent } from 'https';
import { readFileSync } from 'fs';
import { warn } from 'console';

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

      response$
        .pipe(mapAsyncResponse(abortEvent, runtimeApi, requestId, response$, completed$))
        .subscribe((response) => {
          log('Response sent to Runtime API', { requestId });
          completed$.next(response);
        });

      return {
        runtimeApi,
        requestId,
        headers: next.headers,
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
  if (handler.startsWith('http://') || handler.startsWith('https://')) {
    return of(new URL(handler));
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
  const payload = new PassThrough();

  const subprocess = execa(command, {
    shell: true,
    env: { ...process.env, ...env },
    verbose: isDebug,
    all: true,
    signal: abortEvent.signal,
  });

  subprocess.all?.pipe(payload);
  payload.pipe(process.stdout);

  subprocess.on('exit', () => {
    payload.end();
  });

  return from(subprocess).pipe(
    catchError((e) => {
      return throwError(() => new Error(`Error executing \`${command}\`: ${e.all}`));
    }),
    map((output) => {
      return {
        requestId: runtimeEvent.requestId,
        response$: runtimeEvent.response$,
        completed$: runtimeEvent.completed$,
        prelude: {
          statusCode: output.exitCode === 0 ? 200 : 500,
          headers: {
            'Content-Type': 'text/plain',
            'X-Exit-Code': `${output.exitCode || 0}`,
          },
        },
        payload,
      };
    }),
  );
};

const proxy$ = (
  abortEvent: AbortEvent,
  runtimeEvent: RuntimeEvent,
  stream: boolean,
  url?: string,
  method?: string,
  headers?: {
    [name: string]: string | undefined;
  },
  data?: unknown,
  deadline?: number,
): Observable<AsyncResponse> => {
  info('Proxy request', { method, url });
  log('Proxying request', { headers, data, deadline, stream });

  if (method === 'GET' && headers?.['sec-websocket-version'] && headers?.['sec-websocket-key']) {
    return throwError(() => new Error('Websockets are not supported'));
  }

  const proxyHeaders = { ...(headers || {}) };
  let httpsAgent: Agent | undefined = undefined;

  if (url?.startsWith('https://')) {
    const { TLS_CERT_FILE, TLS_KEY_FILE } = process.env;
    httpsAgent = new Agent({
      checkServerIdentity: url?.startsWith('https://localhost:') ? () => undefined : undefined,
      rejectUnauthorized: url?.startsWith('https://localhost:') ? false : undefined,
      cert: TLS_CERT_FILE ? readFileSync(TLS_CERT_FILE) : undefined,
      key: TLS_KEY_FILE ? readFileSync(TLS_KEY_FILE) : undefined,
    });
  }

  return defer(() => {
    return axios.request({
      method,
      url,
      headers: proxyHeaders,
      data,
      httpsAgent,
      timeout: deadline ? deadline - Date.now() : undefined,
      maxRedirects: 0,
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

      const prelude: AsyncPrelude = {
        statusCode: resp.status,
        headers: transformAxiosResponseHeaders(responseHeaders),
        cookies: transformAxiosResponseCookies(responseHeaders),
      };

      return {
        requestId: runtimeEvent.requestId,
        response$: runtimeEvent.response$,
        completed$: runtimeEvent.completed$,
        prelude,
        payload: stream ? responseData : buffer(responseData),
      };
    }),
  );
};

const transformDynamoDBEvent = (
  routes: Routes,
  event: Partial<DynamoDBStreamEvent>,
): Partial<APIGatewayProxyEventV2> => {
  const host = 'dynamodb.amazonaws.com';
  const path = routes[host];
  if (!path) {
    throw new Error('No handler found for dynamodb.amazonaws.com');
  }
  return {
    requestContext: {
      http: {
        method: 'POST',
        path,
      },
    },
    headers: {
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
      host,
    } as Record<string, unknown>,
    isBase64Encoded: false,
    body: JSON.stringify(event),
  } as Partial<APIGatewayProxyEventV2>;
};

const transformS3Event = (
  routes: Routes,
  event: Partial<S3Event>,
): Partial<APIGatewayProxyEventV2> => {
  const host = 's3.amazonaws.com';
  const path = routes[host];
  if (!path) {
    throw new Error('No handler found for s3.amazonaws.com');
  }
  return {
    requestContext: {
      http: {
        method: 'POST',
        path,
      },
    },
    headers: {
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
      host,
    } as Record<string, unknown>,
    isBase64Encoded: false,
    body: JSON.stringify(event),
  } as Partial<APIGatewayProxyEventV2>;
};

const transformEvent = (
  routes: Routes,
  headers: Record<string, unknown>,
  event?: Partial<APIGatewayProxyEventV2 | ALBEvent | DynamoDBStreamEvent | S3Event | undefined>,
): Partial<APIGatewayProxyEventV2 | ALBEvent> => {
  if (typeof event !== 'object') {
    throw new Error('Event is not an object'); // TODO Maybe an error observable
  }

  const lambdaHeaders = Object.entries(headers).reduce((acc, [key, value]) => {
    if (key.startsWith('lambda-') && typeof value === 'string') {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, string | undefined>);

  if ('Records' in event && Array.isArray(event.Records)) {
    if (event.Records.every((r) => 'dynamodb' in r)) {
      event = transformDynamoDBEvent(routes, event as Partial<DynamoDBStreamEvent>);
    } else if (event.Records.every((r) => 's3' in r)) {
      event = transformS3Event(routes, event as Partial<S3Event>);
    }
  }

  if (!('requestContext' in event)) {
    throw new Error('Request context missing in event');
  }

  event.headers = {
    ...lambdaHeaders,
    ...(event.headers || {}),
  };

  return event;
};

export const asyncResponse$ = (
  abortEvent: AbortEvent,
  runtimeEvent: RuntimeEvent,
  routes: Routes,
): Observable<AsyncResponse> => {
  const rawEvent = JSON.parse(runtimeEvent.event) as Partial<
    APIGatewayProxyEventV2 | ALBEvent | DynamoDBStreamEvent | string
  >;

  const deadline = runtimeEvent.deadline - 1000; // Subtract 1 second to allow errors to propagate
  let stream = false;

  if (typeof rawEvent === 'string') {
    if (!rawEvent.startsWith(`${CONFIG_SIGNATURE}:`)) {
      return throwError(() => new Error(`Raw event is missing ${CONFIG_SIGNATURE}`));
    }
    return shell$(abortEvent, runtimeEvent, rawEvent, runtimeEvent.env);
  }

  const { requestContext, headers, body, isBase64Encoded } = transformEvent(
    routes,
    runtimeEvent.headers,
    rawEvent,
  );

  if (!requestContext) {
    return throwError(() => new Error('Missing request context'));
  }

  if ('domainName' in requestContext) {
    stream = requestContext.domainName.indexOf('.lambda-url.') !== -1;
  }

  let method: string | undefined = undefined;
  if ('http' in requestContext) {
    method = requestContext.http.method;
  }
  if ('elb' in requestContext && 'httpMethod' in rawEvent) {
    method = rawEvent.httpMethod;
  }

  let rawPath: string | undefined = undefined;
  if (!rawPath && 'rawPath' in rawEvent && typeof rawEvent.rawPath === 'string') {
    rawPath = rawEvent.rawPath;
  }
  if (!rawPath && 'http' in requestContext) {
    rawPath = requestContext.http.path;
  }
  if (!rawPath && 'elb' in requestContext && 'path' in rawEvent) {
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
    return throwError(() => new Error(`No handler found for ${rawPath}`));
  }

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
        stream,
        url.toString(),
        method,
        headers,
        isBase64Encoded && !!body ? Buffer.from(body, 'base64') : body,
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
