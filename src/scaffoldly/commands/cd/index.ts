import { ECRClient } from '@aws-sdk/client-ecr';
import { Command } from '../index';
import { IAMClient } from '@aws-sdk/client-iam';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { NotFoundException } from './aws/errors';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { isDebug } from '../../ui';
import { ui } from '../../command';
import { SchedulerClient } from '@aws-sdk/client-scheduler';

export type CloudClient =
  | ECRClient
  | IAMClient
  | LambdaClient
  | SecretsManagerClient
  | SchedulerClient;

export type ResourceOptions = {
  clean?: boolean;
  destroy?: boolean;
};

export type CloudResource<
  Client extends CloudClient,
  Resource,
  CreateCommand,
  UpdateCommand,
  DisposeCommand,
> = {
  client: Client;
  disposable?: Promise<boolean>;
  read: () => Promise<Resource>;
  create: (command: CreateCommand) => Promise<Resource>;
  update: (command: UpdateCommand) => Promise<Resource>;
  dispose?: (resource: Partial<Resource>, command: DisposeCommand) => Promise<Partial<Resource>>;
  request: {
    create: CreateCommand;
    update?: UpdateCommand;
    dispose?: DisposeCommand;
  };
};

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
