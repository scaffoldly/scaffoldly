import { json } from 'express';
import { HttpServer, HttpServerOptions } from '../../http/http-server';
import { AsyncSubject, BehaviorSubject, Observable, switchMap, of, filter, take } from 'rxjs';
import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { ContainerPool } from '../../docker/container-pool';

export const RUNTIME_SERVER_PORT = 9001;

type ResonseSubject = AsyncSubject<APIGatewayProxyStructuredResultV2 | undefined>;

interface Invocation {
  requestId: string;
  event: APIGatewayProxyEventV2;
  response$: ResonseSubject;
}

class Invocations {
  private invocations: Invocation[] = [];

  private invocationMap: Map<string, Invocation> = new Map();

  private count$ = new BehaviorSubject<number>(0);

  private size$ = new BehaviorSubject<number>(0);

  get size(): Observable<number> {
    return this.size$.asObservable();
  }

  get(requestId: string): Invocation | undefined {
    return this.invocationMap.get(requestId);
  }

  enqueue(invocation: Invocation): void {
    this.invocations.push(invocation);
    this.invocationMap.set(invocation.requestId, invocation);
    this.size$.next(this.invocations.length);
    this.count$.next(this.count$.value + 1);
    invocation.response$.subscribe({
      complete: () => {
        this.invocationMap.delete(invocation.requestId);
      },
    });
  }

  dequeue(): Observable<Invocation> {
    return this.count$
      .pipe(
        switchMap(() => {
          const invocation = this.invocations.shift();
          this.size$.next(this.invocations.length);
          return of(invocation);
        }),
      )
      .pipe(
        filter((i) => !!i),
        take(1),
      );
  }
}

export class LambdaRuntimeServer extends HttpServer {
  private invocations: Invocations = new Invocations();

  constructor(
    private containerPool: ContainerPool,
    protected options: HttpServerOptions & { maxConcurrency: number } = {
      maxConcurrency: 5,
      timeout: 0,
    },
  ) {
    super('Lambda Runtime', RUNTIME_SERVER_PORT, containerPool.abortController);

    this.invocations.size.subscribe((size) => {
      this.containerPool.setConcurrency(size, this.options.maxConcurrency);
    });
  }

  async registerHandlers(): Promise<void> {
    this.app.use(json({ limit: '6MB' }));

    this.app.get('/2018-06-01/runtime/invocation/next', (req, res) => {
      req.setTimeout(0);
      // TODO: Socket timeouts need will drop an event
      this.invocations.dequeue().subscribe((invocation) => {
        this.log(`START RequestId: ${invocation.requestId} Version: $LATEST`);
        const deadline = new Date().getTime() + 3000;
        res.header('lambda-runtime-aws-request-id', invocation.requestId);
        res.header('lambda-runtime-deadline-ms', `${deadline}`);
        res.json(invocation.event);
      });
    });

    this.app.post('/2018-06-01/runtime/invocation/:requestId/response', (req, res) => {
      this.log(`END RequestId: ${req.params.requestId}`);
      const invocation = this.invocations.get(req.params.requestId);
      if (!invocation) {
        res.status(404).send('Invocation not found');
        return;
      }
      invocation.response$.next(req.body);
      invocation.response$.complete();
      res.status(202).send('');
      // TODO: Init Duration: 0.00 ms
      this.log(
        `REPORT RequestId: ${req.params.requestId} Duration: 0.00 ms Billed Duration: 0 ms Memory Size: 0 MB Max Memory Used: 0 MB`,
      );
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

    this.invocations.enqueue(invocation);

    return invocation.response$;
  }
}
