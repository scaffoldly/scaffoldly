import { Command } from '../index';
import { isDebug } from '../../ui';
import { ui } from '../../command';
import promiseRetry from 'promise-retry';
import _ from 'lodash';
import { NotFoundException, SkipAction } from './errors';
import { Mode } from '../../../config';
import { GitService } from './git';

type Differences = {
  [key: string]: unknown | Differences;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDifferences(subset: any, superset: any): Differences {
  const differences: Differences = {};

  _.forEach(subset, (value, key) => {
    const supersetValue = (superset as Record<string, unknown>)[key];

    if (_.isObject(value) && !_.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nestedDifferences = getDifferences(value as any, supersetValue as any);
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
  retries?: number;
  notify?: (message: string, level?: 'notice' | 'error') => void;
  dev?: boolean;
  checkPermissions?: boolean;
  buildOnly?: boolean;
  dryRun?: boolean;
  permissionsAware?: PermissionAware;
};

export type ResourceExtractor<Resource, ReadCommandOutput> = (
  output: Partial<ReadCommandOutput>,
) => Partial<Resource> | undefined;

export class CloudResource<Resource, ReadCommandOutput> implements PromiseLike<Partial<Resource>> {
  private options: ResourceOptions = {};

  private desired?: Partial<ReadCommandOutput>;

  constructor(
    public readonly requests: {
      describe: (resource: Partial<Resource>) => { type: string; label: string };
      read: () => Promise<ReadCommandOutput>;
      create?: () => Promise<unknown>;
      update?: (resource: Partial<Resource>) => Promise<unknown>;
      dispose?: (resource: Partial<Resource>) => Promise<unknown>;
      emitPermissions?: (aware: PermissionAware) => void;
    },
    private readonly resourceExtractor: ResourceExtractor<Resource, ReadCommandOutput>,
  ) {}

  then<TResult1 = Partial<Resource>, TResult2 = never>(
    onfulfilled?:
      | ((value: Partial<Resource>) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const { emitPermissions } = this.requests;
    if (emitPermissions && options.permissionsAware) {
      emitPermissions(options.permissionsAware);
    }

    if (options.checkPermissions) {
      return {} as Partial<Resource>;
    }

    this.logResource('Reading', {}, options);
    let existing = await this.read(options);

    if (existing) {
      try {
        this.logResource('Updating', existing, options);
        existing = await this.update(options, existing, desired);
        this.logResource('Updated', existing, options);
      } catch (e) {
        this.logResource('Updated', e, options);
      }
    } else {
      try {
        this.logResource('Creating', existing, options);
        existing = await this.create(options, desired);
        this.logResource('Created', existing, options);
      } catch (e) {
        this.logResource('Created', e, options);
      }
    }

    if (!existing) {
      if (options.dryRun) {
        return {} as Partial<Resource>;
      }
      throw new Error('Failed to manage resource');
    }

    return existing;
  }

  public async dispose(): Promise<Partial<Resource>> {
    const existing = await this;

    if (this.options.checkPermissions) {
      return {} as Partial<Resource>;
    }

    if (!existing) {
      return {} as Partial<Resource>;
    }

    const { dispose } = this.requests;
    if (!dispose) {
      return existing;
    }

    await dispose(existing).catch(() => {});
    const current = await this.read(this.options).catch(() => ({} as Partial<Resource>));

    if (!current) {
      return {} as Partial<Resource>;
    }

    return current;
  }

  private async read(
    options: ResourceOptions,
    desired?: Partial<unknown>,
  ): Promise<Partial<Resource> | undefined> {
    const { read } = this.requests;
    if (!read) {
      return undefined;
    }

    const response = await promiseRetry(
      async (retry) => {
        try {
          const readResponse = await read();
          if (isDebug() && readResponse) {
            console.log(`   --> [READ]`, readResponse);
          }

          const difference = getDifferences(desired || {}, readResponse);

          if (Object.keys(difference).length) {
            if (isDebug()) {
              ui.updateBottomBarSubtext(
                `Waiting for resource to be ready: ${JSON.stringify(difference)}`,
              );
            }

            return retry(new Error('Resource is not ready'));
          }

          const resource = this.resourceExtractor(readResponse);
          if (isDebug() && resource) {
            console.log(`   `, resource);
          }

          return resource;
        } catch (e) {
          if (options.dryRun) {
            return undefined;
          }
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

          return retry(e);
        }
      },
      {
        retries: options.retries !== Infinity ? options.retries || 0 : 0,
        forever: options.retries === Infinity,
      },
    );

    return response;
  }

  private async create(
    options: ResourceOptions,
    desired?: Partial<ReadCommandOutput>,
  ): Promise<Partial<Resource> | undefined> {
    const { create } = this.requests;

    if (!create) {
      return undefined;
    }

    if (options.dryRun) {
      return undefined;
    }

    const created = await promiseRetry(
      (retry) =>
        create().catch((e) => {
          if (
            '$metadata' in e &&
            'httpStatusCode' in e.$metadata &&
            (e.$metadata.httpStatusCode === 403 || e.$metadata.httpStatusCode === 401)
          ) {
            throw e;
          }

          return retry(e);
        }),
      {
        retries: options.retries !== Infinity ? options.retries || 0 : 0,
        forever: options.retries === Infinity,
      },
    );

    if (isDebug() && created) {
      console.log(`   --> [CREATED]`, created);
    }

    const resource = await this.read(options, desired);

    return resource;
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

    if (options.dryRun) {
      return existing;
    }

    const updated = await promiseRetry(
      (retry) =>
        update(existing).catch((e) => {
          if (
            '$metadata' in e &&
            'httpStatusCode' in e.$metadata &&
            (e.$metadata.httpStatusCode === 403 || e.$metadata.httpStatusCode === 401)
          ) {
            throw e;
          }

          return retry(e);
        }),
      {
        retries: options.retries !== Infinity ? options.retries || 0 : 0,
        forever: options.retries === Infinity,
      },
    );

    if (isDebug() && updated) {
      console.log(`   --> [UPDATED]`, updated);
    }

    const resource = await this.read(options, desired);

    return resource;
  }

  logResource(
    action: 'Reading' | 'Creating' | 'Created' | 'Updating' | 'Updated',
    resource: Partial<Resource | undefined> | Error,
    options: ResourceOptions,
  ): void {
    let verb:
      | '✨'
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

    if (options.dryRun) {
      switch (action) {
        case 'Created':
        case 'Updated':
          verb = '✨';
          emoji = '';
          break;
      }
    }

    const message = `${verb} ${type}`;
    let resourceMessage = '';

    if (typeof resource === 'string') {
      resourceMessage = resource;
    } else if (resource instanceof Error) {
      resourceMessage = resource.message;
    } else if (label) {
      resourceMessage = label;
    }

    if (options.dryRun) {
      switch (action) {
        case 'Created':
          resourceMessage = `${resourceMessage} (would be created)`;
          break;
        case 'Updated':
          resourceMessage = `${resourceMessage} (would be updated)`;
          break;
      }
    }

    let messageOutput = message;
    if (resourceMessage) {
      messageOutput = `${messageOutput}: ${resourceMessage}`;
    }

    if (resource instanceof SkipAction) {
      if (isDebug()) {
        console.log(`   --> [SKIPPED]`, messageOutput);
      }
      return;
    }

    switch (verb) {
      case '✨':
      case 'Created':
      case 'Updated':
      case 'Failed to Create':
      case 'Failed to Update':
        ui.updateBottomBar('');
        console.log(`${emoji ? `${emoji} ` : ''}${messageOutput}`);
        if (options.notify) {
          options.notify(messageOutput, resource instanceof Error ? 'error' : 'notice');
        }
        break;
      case 'Reading':
      case 'Creating':
      case 'Updating':
        ui.updateBottomBar(messageOutput);
        break;
    }

    if (resource instanceof Error) {
      throw new Error('Unable to manage resource', { cause: resource });
    }
  }
}

export abstract class CdCommand<T> extends Command<T> {
  constructor(protected gitService: GitService, mode: Mode) {
    super(gitService, mode);
  }
}

export interface PermissionAware {
  withPermissions(permissions: string[]): void;

  get permissions(): string[];
}
