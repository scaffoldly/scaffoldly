import { Command } from '../index';
import { isDebug } from '../../ui';
import { ui } from '../../command';
import promiseRetry from 'promise-retry';
import _ from 'lodash';

export type CloudClient<ReadCommand, CreateCommand, UpdateCommand, DisposeCommand> = {
  send<T>(command: ReadCommand): Promise<T>;
  send<T>(command: CreateCommand): Promise<T>;
  send<T>(command: UpdateCommand): Promise<T>;
  send<T>(command: DisposeCommand): Promise<T>;
};

type Differences = {
  [key: string]: unknown | Differences;
};

function getDifferences(subset: object, superset: object): Differences {
  const differences: Differences = {};

  _.forEach(subset, (value, key) => {
    const supersetValue = (superset as Record<string, unknown>)[key];

    if (_.isObject(value) && !_.isArray(value)) {
      const nestedDifferences = getDifferences(value as object, supersetValue as object);
      if (!_.isEmpty(nestedDifferences)) {
        differences[key] = nestedDifferences;
      }
    } else if (!_.isEqual(value, supersetValue)) {
      differences[key] = { expected: value, actual: supersetValue };
    }
  });

  return differences;
}

export type ResourceOptions = {
  destroy?: boolean;
  retries?: number;
};

export type ResourceExtractor<Resource, ReadCommandOutput> = (
  output: Partial<ReadCommandOutput>,
) => Partial<Resource> | undefined;

export class CloudResource<Resource, ReadCommandOutput> {
  constructor(
    // public readonly client: CloudClient<ReadCommand, CreateCommand, UpdateCommand, DisposeCommand>,
    public readonly requests: {
      describe: (resource: Partial<Resource>) => string;
      read: () => Promise<ReadCommandOutput>;
      create?: () => Promise<unknown>;
      update?: (resource: Partial<Resource>) => Promise<unknown>;
      dispose?: (resource: Partial<Resource>) => Promise<unknown>;
    },
    private readonly resourceExtractor: ResourceExtractor<Resource, ReadCommandOutput>,
  ) {}

  private read(
    options: ResourceOptions,
    desired?: Partial<unknown>,
  ): () => Promise<Partial<Resource> | undefined> {
    return async () => {
      try {
        const { read } = this.requests;
        const response = await promiseRetry(
          (retry) =>
            read().then((readResponse) => {
              const difference = getDifferences(desired || {}, readResponse as Partial<unknown>);

              if (Object.keys(difference).length) {
                if (isDebug()) {
                  ui.updateBottomBarSubtext(
                    `Waiting for resource to be ready: ${JSON.stringify(difference)}`,
                  );
                }

                return retry(new Error('Resource is not ready'));
              }

              return readResponse as Partial<unknown>;
            }),
          {
            retries: options.retries !== Infinity ? options.retries || 0 : 0,
            forever: options.retries === Infinity,
          },
        );
        return this.resourceExtractor(response);
      } catch (e) {
        if (
          '$metadata' in e &&
          'httpStatusCode' in e.$metadata &&
          e.$metadata.httpStatusCode === 404
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

  private async create(
    options: ResourceOptions,
    desired?: Partial<ReadCommandOutput>,
  ): Promise<Partial<Resource> | undefined> {
    const { create } = this.requests;

    if (!create) {
      return undefined;
    }

    await promiseRetry(
      async (retry) => {
        return create()
          .then((created) => {
            if (isDebug()) {
              ui.updateBottomBarSubtext(`Created: ${JSON.stringify(created)}`);
            }
            return created;
          })
          .catch((e) => {
            if (isDebug()) {
              ui.updateBottomBarSubtext(`Create error: ${e.message}`);
            }
            return retry(e);
          });
      },
      {
        retries: options.retries !== Infinity ? options.retries || 0 : 0,
        forever: options.retries === Infinity,
      },
    );

    return this.read(options, desired)();
  }

  private async update(
    options: ResourceOptions,
    existing: Partial<Resource>,
    desired?: Partial<ReadCommandOutput>,
  ): Promise<Partial<Resource> | undefined> {
    const { update } = this.requests;
    if (!update) {
      return existing;
    }

    await promiseRetry(
      async (retry) => {
        return update(existing)
          .then((updated) => {
            if (isDebug()) {
              ui.updateBottomBarSubtext(`Updated: ${JSON.stringify(updated)}`);
            }
            return updated;
          })
          .catch((e) => {
            if (isDebug()) {
              ui.updateBottomBarSubtext(`Create error: ${e.message}`);
            }
            return retry(e);
          });
      },
      {
        retries: options.retries !== Infinity ? options.retries || 0 : 0,
        forever: options.retries === Infinity,
      },
    );

    return this.read(options, desired)();
  }

  // private async dispose<T>(): Promise<Partial<T>> {
  //   const { dispose } = this.requests;
  //   if (!dispose) {
  //     return {} as Partial<T>;
  //   }
  //   return this.client.send<T>(dispose);
  // }

  async manage(
    options: ResourceOptions,
    desired?: Partial<ReadCommandOutput>,
  ): Promise<Partial<Resource>> {
    if (options.destroy) {
      throw new Error('Not implemented');
    }

    let existing = await this.read(options)();

    if (existing) {
      try {
        existing = await this.update(options, existing, desired);
        this.handleResource('update', existing);
      } catch (e) {
        this.handleResource('update', e);
      }
    } else {
      try {
        existing = await this.create(options, desired);
        this.handleResource('create', existing);
      } catch (e) {
        this.handleResource('create', e);
      }
    }

    if (!existing) {
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
        message = `✅ Created`;
        break;
      case 'update':
        message = `✅ Updated`;
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
      message = `🤔\tUnknown ${action}`;
      resourceMessage = 'Resource not found';
    } else if (typeof resource === 'string') {
      resourceMessage = resource;
    } else if (resource instanceof Error) {
      resourceMessage = resource.message;
    } else {
      resourceMessage = this.requests.describe(resource);
    }

    ui.updateBottomBar('');
    console.log(`${message} ${resourceMessage}`);
    if (isDebug()) {
      console.log(`   ${JSON.stringify(resource)}`);
    } else {
      console.log('');
    }

    if (resource instanceof Error) {
      throw resource;
    }

    return resource;
  }
}

export class CdCommand extends Command {}
