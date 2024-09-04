import { json, Request, Response } from 'express';
import { HttpServer, HttpServerOptions } from '../../http/http-server';
import {
  AsyncSubject,
  BehaviorSubject,
  Observable,
  filter,
  take,
  Subject,
  map,
  mergeMap,
} from 'rxjs';
import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { ContainerPool } from '../../docker/container-pool';
import { GitService } from '../../../cd/git';
import { buffer } from 'stream/consumers';
import {
  fromResponseStream,
  RESPONSE_STREAM_HEADERS,
} from '../../../../../awslambda-entrypoint/util';
import { convertHeaders } from './function-url-server';
import { Readable } from 'stream';

export const RUNTIME_SERVER_PORT = 9001;

type ResonseSubject = AsyncSubject<APIGatewayProxyStructuredResultV2 | undefined>;

interface Invocation {
  requestId: string;
  event: APIGatewayProxyEventV2;
  response$: ResonseSubject;
}

interface NextRequest {
  req: Request;
  res: Response;
  hasError: () => boolean;
}

export class LambdaRuntimeServer extends HttpServer {
  private invocations$ = new BehaviorSubject<Invocation[]>([]);

  private request$ = new Subject<NextRequest>();

  constructor(
    private gitService: GitService,
    private containerPool: ContainerPool,
    protected options: HttpServerOptions & { maxConcurrency: number } = {
      maxConcurrency: 5,
      timeout: 0,
    },
  ) {
    super('Lambda Runtime', RUNTIME_SERVER_PORT, containerPool.abortController);

    this.invocations$.subscribe((invocations) => {
      this.log(`Concurrent Invocations: ${invocations.length}`);
      this.containerPool.setConcurrency(invocations.length, options.maxConcurrency);
    });

    this.observeInvocations().subscribe({
      next: ({ nextRequest, nextInvocation }) => {
        this.handleInvocation(nextRequest, nextInvocation);
      },
      error: (e) => {
        this.error('Error handling invocation.', { cause: e });
      },
    });
  }

  observeInvocations(): Observable<{
    nextRequest: NextRequest;
    nextInvocation: Invocation;
  }> {
    return this.request$.pipe(
      mergeMap((nextRequest) =>
        this.invocations$.pipe(
          filter((queue) => queue.length > 0),
          take(1),
          map((queue) => {
            const [nextInvocation, ...restQueue] = queue;
            if (nextRequest.hasError()) {
              this.warn('Request has an error. Requeueing invocation.');
              this.invocations$.next([nextInvocation, ...restQueue]);
            } else {
              this.invocations$.next(restQueue);
            }
            return { nextRequest, nextInvocation };
          }),
        ),
      ),
    );
  }

  handleInvocation(nextRequest: NextRequest, nextInvocation: Invocation): void {
    this.log(`START RequestId: ${nextInvocation.requestId} Version: $LATEST`);
    const start = new Date().getTime();

    const deadline = new Date().getTime() + this.gitService.config.timeout * 1000;
    nextRequest.res.header('lambda-runtime-aws-request-id', nextInvocation.requestId);
    nextRequest.res.header('lambda-runtime-deadline-ms', `${deadline}`);

    // Add the return route
    this.app.post(
      `/2018-06-01/runtime/invocation/${nextInvocation.requestId}/response`, // TODO: remove on completion?
      async (responseReq, responseRes, responseNext) => {
        this.log(`END RequestId: ${nextInvocation.requestId}`);
        const end = new Date().getTime();
        const duration = end - start;

        try {
          const { headers } = responseReq;
          Object.entries(RESPONSE_STREAM_HEADERS).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value = value.join(', ');
            }

            const headerValue = headers[key.toLowerCase()];

            if (headerValue !== value) {
              throw new Error(`Invalid header: ${key}, got ${headerValue}, expected ${value}`);
            }
          });

          const { prelude, payload } = await fromResponseStream(new Readable().wrap(responseReq));
          const body = (await buffer(payload)).toString('base64');
          const isBase64Encoded = true;

          // TODO: Cookies
          nextInvocation.response$.next({
            statusCode: prelude.statusCode,
            headers: convertHeaders(prelude.headers, nextInvocation.requestId),
            body,
            isBase64Encoded,
          });

          nextInvocation.response$.complete();

          this.log(
            `REPORT RequestId: ${nextInvocation.requestId} Duration: ${duration}.00 ms Billed Duration: ${duration} ms Memory Size: 0 MB Max Memory Used: 0 MB`,
          );

          responseRes.status(202).send('');
        } catch (e) {
          return responseNext(e);
        }
      },
    );

    nextRequest.res.status(200).json(nextInvocation.event).end();
  }

  async registerHandlers(): Promise<void> {
    // TODO: Compression Supported? Streaming?
    this.app.use(json({ limit: '6MB' }));
    this.app.get('/2018-06-01/runtime/invocation/next', (req, res) => {
      req.setTimeout(0);

      let errored = false;
      const hasError = () => errored;

      req.on('error', (e) => {
        this.warn('Invocation poll error', { cause: e });
        errored = true;
      });

      this.request$.next({ req, res, hasError });
    });
    this.app.get('/', (_req, res) => {
      res.status(204).send('');
    });
  }

  emit(event: APIGatewayProxyEventV2): ResonseSubject {
    const requestId = event.requestContext.requestId;
    const response$ = new AsyncSubject<APIGatewayProxyStructuredResultV2 | undefined>();

    const invocation: Invocation = {
      requestId,
      event,
      response$,
    };

    this.invocations$.next([...this.invocations$.value, invocation]);

    return invocation.response$;
  }
}
