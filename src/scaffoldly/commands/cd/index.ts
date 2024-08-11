import { Command } from '../index';
import { isDebug } from '../../ui';
import { ui } from '../../command';
import promiseRetry from 'promise-retry';
import _ from 'lodash';
import { NotFoundException } from './aws/errors';

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

export class CloudResource<Resource, ReadCommandOutput> implements PromiseLike<Partial<Resource>> {
  private options: ResourceOptions = {};
  private desired?: Partial<ReadCommandOutput>;

  constructor(
    public readonly requests: {
      describe: (resource: Partial<Resource>) => { type: string; label?: string };
      read: () => Promise<ReadCommandOutput>;
      create?: () => Promise<unknown>;
      update?: (resource: Partial<Resource>) => Promise<unknown>;
      dispose?: (resource: Partial<Resource>) => Promise<unknown>;
    },
    private readonly resourceExtractor: ResourceExtractor<Resource, ReadCommandOutput>,
  ) {}

  then<TResult1 = Partial<Resource>, TResult2 = never>(
    onfulfilled?:
      | ((value: Partial<Resource>) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this._manage(this.options, this.desired).then(onfulfilled, onrejected);
  }

  public manage(
    options: ResourceOptions,
    desired?: Partial<ReadCommandOutput>,
  ): CloudResource<Resource, ReadCommandOutput> {
    this.options = options;
    this.desired = desired;
    return this;
  }

  async _manage(
    options: ResourceOptions,
    desired?: Partial<ReadCommandOutput>,
  ): Promise<Partial<Resource>> {
    if (options.destroy) {
      throw new Error('Not implemented');
    }

    this.handleResource('Reading', {});
    let existing = await this.read(options)();

    if (existing) {
      try {
        this.handleResource('Updating', existing);
        existing = await this.update(options, existing, desired);
        this.handleResource('Updated', existing);
      } catch (e) {
        this.handleResource('Updated', e);
      }
    } else {
      try {
        this.handleResource('Creating', existing);
        existing = await this.create(options, desired);
        this.handleResource('Created', existing);
      } catch (e) {
        this.handleResource('Created', e);
      }
    }

    if (!existing) {
      throw new Error('Failed to manage resource');
    }

    return existing;
  }

  public async dispose(): Promise<Partial<Resource>> {
    let existing = await this;

    if (!existing) {
      return {} as Partial<Resource>;
    }

    const { dispose } = this.requests;
    if (!dispose) {
      return existing;
    }

    await dispose(existing).catch(() => {});
    const current = await this.read(this.options)().catch(() => ({} as Partial<Resource>));

    if (!current) {
      return {} as Partial<Resource>;
    }

    return current;
  }

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
        if (e instanceof NotFoundException) {
          return undefined;
        }
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

  private async handleResource(
    action: 'Reading' | 'Creating' | 'Created' | 'Updating' | 'Updated',
    resource: Partial<Resource | undefined> | Error,
  ): Promise<Partial<Resource | undefined>> {
    let verb:
      | 'Reading'
      | 'Creating'
      | 'Created'
      | 'Updating'
      | 'Updated'
      | 'Failed to Create'
      | 'Failed to Update' = action;
    let emoji = '🤔';
    let type = 'Resource';
    let label: string | undefined;

    switch (action) {
      case 'Created':
      case 'Updated':
        emoji = '✅';
        break;
      case 'Reading':
      case 'Creating':
      case 'Updating':
        emoji = '';
        break;
    }

    if (resource instanceof Error) {
      emoji = '❌';
      switch (action) {
        case 'Created':
          verb = 'Failed to Create';
          break;
        case 'Updated':
          verb = 'Failed to Update';
          break;
      }
      const description = this.requests.describe({});
      type = description.type;
      label = description.label;
    } else {
      const description = this.requests.describe(resource || {});
      type = description.type;
      label = description.label;
    }

    let message = `${emoji ? `${emoji} ` : ''}${verb} ${type}`;
    let resourceMessage = '';

    if (!resource) {
      resourceMessage = 'Unknown Resource';
    } else if (typeof resource === 'string') {
      resourceMessage = resource;
    } else if (resource instanceof Error) {
      resourceMessage = resource.message;
    } else {
      if (label) {
        resourceMessage = `: ${label}`;
      }
    }

    switch (verb) {
      case 'Created':
      case 'Updated':
      case 'Failed to Create':
      case 'Failed to Update':
        ui.updateBottomBar('');
        console.log(`${message}${resourceMessage}`);
        if (isDebug()) {
          console.log(`   ${JSON.stringify(resource)}`);
        } else {
          console.log('');
        }
        break;
      case 'Reading':
      case 'Creating':
      case 'Updating':
        ui.updateBottomBar(`${message}${resourceMessage}`);
        break;
    }

    if (resource instanceof Error) {
      throw resource;
    }

    return resource;
  }
}

export class CdCommand extends Command {}
