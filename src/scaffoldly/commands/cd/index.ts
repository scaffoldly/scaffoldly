import { ECRClient } from '@aws-sdk/client-ecr';
import { Command } from '../index';
import { IAMClient } from '@aws-sdk/client-iam';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { NotFoundException } from './aws/errors';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { isDebug } from '../../ui';
import { ui } from '../../command';
import { SchedulerClient } from '@aws-sdk/client-scheduler';
import promiseRetry from 'promise-retry';
import _ from 'lodash';

export type CloudClient<ReadCommand, CreateCommand, UpdateCommand, DisposeCommand> = {
  send<T>(command: ReadCommand): Promise<T>;
  send<T>(command: CreateCommand): Promise<T>;
  send<T>(command: UpdateCommand): Promise<T>;
  send<T>(command: DisposeCommand): Promise<T>;
};

export type ResourceOptions = {
  clean?: boolean;
  destroy?: boolean;
};

export type CloudRequests<ReadCommand, CreateCommand, UpdateCommand, DisposeCommand> = {
  read: ReadCommand;
  create?: CreateCommand;
  update?: UpdateCommand;
  dispose?: DisposeCommand;
};

export type ResourceExtractor<Resource, ReadCommandOutput> = (
  output: Partial<ReadCommandOutput>,
) => Partial<Resource>;

export abstract class AbstractCloudResource<
  Resource,
  ReadCommand,
  ReadCommandOutput,
  CreateCommand,
  UpdateCommand,
  DisposeCommand,
> {
  constructor(
    public readonly client: CloudClient<ReadCommand, CreateCommand, UpdateCommand, DisposeCommand>,
    public readonly identifier: keyof Resource extends string ? keyof Resource : never,
    public readonly requests: CloudRequests<
      ReadCommand,
      CreateCommand,
      UpdateCommand,
      DisposeCommand
    >,
    private readonly resourceExtractor: ResourceExtractor<Resource, ReadCommandOutput>,
  ) {}

  private read(
    desired?: Partial<ReadCommandOutput>,
    retries?: number,
  ): () => Promise<Partial<Resource | undefined>> {
    return async () => {
      try {
        const { read } = this.requests;
        const response = await promiseRetry(
          (retry) =>
            this.client.send<ReadCommandOutput>(read).then((readResponse) => {
              const actual = Object.entries(readResponse || {}).reduce((acc, [key, value]) => {
                if (desired && key in desired) {
                  acc[key] = value;
                }
                return acc;
              }, {} as Record<string, unknown>);

              if (desired && !_.isEqual(actual, desired)) {
                if (isDebug()) {
                  ui.updateBottomBarSubtext('Resource is not ready');
                  ui.updateBottomBarSubtext(`Desired: ${JSON.stringify(desired)}`);
                  ui.updateBottomBarSubtext(`Actual: ${JSON.stringify(actual)}`);
                }

                return retry(new Error('Resource is not ready'));
              }

              return readResponse;
            }),
          { retries: retries !== Infinity ? retries || 0 : 0, forever: retries === Infinity },
        );
        return this.resourceExtractor(response);
      } catch (e) {
        if (
          '$metadata' in e &&
          'httpStatusCode' in e.$metadata &&
          (e.$metadata.httpStatusCode === 404 || e.$metadata.httpStatusCode === 409)
        ) {
          return undefined;
        }
        if (
          '__type' in e &&
          typeof e.__type === 'string' &&
          e.__type.endsWith('NotFoundException')
        ) {
          return undefined;
        }
        throw e;
      }
    };
  }

  private async create<T>(retries?: number): Promise<Partial<T>> {
    const { create } = this.requests;
    if (!create) {
      return {} as Partial<T>;
    }
    return promiseRetry((retry) => this.client.send<T>(create).catch((e) => retry(e)), {
      retries: retries !== Infinity ? retries || 0 : 0,
      forever: retries === Infinity,
    });
  }

  private async update<T>(retries?: number): Promise<Partial<T>> {
    const { update } = this.requests;
    if (!update) {
      return {} as Partial<T>;
    }
    return promiseRetry((retry) => this.client.send<T>(update).catch((e) => retry(e)), {
      retries: retries !== Infinity ? retries || 0 : 0,
      forever: retries === Infinity,
    });
  }

  private async dispose<T>(): Promise<Partial<T>> {
    const { dispose } = this.requests;
    if (!dispose) {
      return {} as Partial<T>;
    }
    return this.client.send<T>(dispose);
  }

  async manage(
    options: ResourceOptions,
    desired?: Partial<ReadCommandOutput>,
    retries?: number,
  ): Promise<Partial<Resource>> {
    if (options.destroy) {
      throw new Error('Not implemented');
    }

    let existing = await this.read(desired, retries)();

    if (existing && !existing[this.identifier]) {
      existing = undefined;
    }

    if (existing) {
      try {
        existing = await this.update(retries).then(this.read(desired, retries));
        this.handleResource('update', existing);
      } catch (e) {
        this.handleResource('update', e);
      }
    } else {
      try {
        existing = await this.create(retries).then(this.read(desired, retries));
        this.handleResource('create', existing);
      } catch (e) {
        this.handleResource('create', e);
      }
    }

    if (!existing) {
      throw new Error('Failed to manage resource');
    }

    if (!existing[this.identifier]) {
      throw new Error('Failed to manage resource');
    }

    return existing;
  }

  private async handleResource(
    action: 'create' | 'update' | 'dispose',
    resource: Partial<Resource | undefined> | Error,
  ): Promise<Partial<Resource | undefined>> {
    let message = '';

    switch (action) {
      case 'create':
        message = `🛠️ Created`;
        break;
      case 'update':
        message = `🔧 Updated`;
        break;
      case 'dispose':
        message = `🗑️ Disposed`;
        break;
    }

    if (resource instanceof Error) {
      message = `❌ Failed to ${action}`;
    }

    let resourceMessage = '';

    if (!resource) {
      message = `🤔 Unknown ${action}`;
      resourceMessage = 'Resource not found';
    } else if (typeof resource === 'string') {
      resourceMessage = resource;
    } else if (resource instanceof Error) {
      resourceMessage = resource.message;
    } else if (resource[this.identifier]) {
      resourceMessage = `${this.identifier}: ${resource[this.identifier]}`;
      if (isDebug()) {
        resourceMessage = JSON.stringify(resource);
      }
    }

    ui.updateBottomBarSubtext(`${message} ${this.constructor.name}: ${resourceMessage}`);

    if (resource instanceof Error) {
      throw resource;
    }

    return resource;
  }
}

const handleResource = <T>(action: 'create' | 'update' | 'dispose', resource: T): T => {
  if (isDebug()) {
    if (typeof resource !== 'object') {
      ui.updateBottomBarSubtext(`Cloud resource (${action}): ${resource}`);
      return resource;
    }
    ui.updateBottomBarSubtext(
      `Cloud resource (${action}): ${JSON.stringify({ ...resource, $metadata: undefined })}`,
    );
  }
  return resource;
};

const handleError = <T>(action: 'create' | 'update' | 'dispose', retry: Promise<T>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (e: any): Promise<T> => {
    if ('$metadata' in e && 'httpStatusCode' in e.$metadata && e.$metadata.httpStatusCode === 404) {
      e = new NotFoundException(e.message, e);
    }
    if ('__type' in e && typeof e.__type === 'string' && e.__type.endsWith('NotFoundException')) {
      e = new NotFoundException(e.message, e);
    }
    if (action === 'create' && !(e instanceof NotFoundException)) {
      return retry;
    }
    if (action === 'update' && e instanceof NotFoundException) {
      return retry;
    }
    if (action === 'dispose' && e instanceof NotFoundException) {
      return retry;
    }
    throw e;
  };
};

export const manageResource = async <
  Client extends CloudClient,
  Resource,
  CreateCommand,
  UpdateCommand,
  DeleteCommand,
>(
  resource: CloudResource<Client, Resource, CreateCommand, UpdateCommand, DeleteCommand>,
  options: ResourceOptions,
): Promise<Partial<Resource>> => {
  const {
    read: readFn,
    create: createFn,
    update: updateFn,
    dispose: disposeFn,
    request,
    disposable = Promise.resolve(false),
  } = resource;
  const { create, update, dispose } = request;

  if (options.destroy) {
    throw new Error('Not implemented');
  }

  if (disposeFn && (await disposable) === true) {
    if (!dispose) {
      throw new Error('Dispose command required');
    }

    const existing = await readFn()
      .then((r) => r as Partial<Resource>)
      .catch((e) => {
        return handleError('dispose', Promise.resolve({} as Partial<Resource>))(e);
      });

    return disposeFn(existing, dispose)
      .then((r) => handleResource('dispose', r))
      .catch((e) => {
        return handleError('dispose', Promise.resolve(existing))(e);
      });
  }

  const creator = createFn(create)
    .then((r) => handleResource('create', r))
    .catch((e) => {
      return handleError('create', readFn())(e);
    });

  if (!update) {
    return creator;
  } else {
    return updateFn(update)
      .then((r) => handleResource('update', r))
      .catch((e) => {
        return handleError('update', creator)(e);
      });
  }
};

export class CdCommand extends Command {}
