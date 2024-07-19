import { ECRClient } from '@aws-sdk/client-ecr';
import { Command } from '../index';
import { IAMClient } from '@aws-sdk/client-iam';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { NotFoundException } from './aws/errors';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { isDebug } from '../../ui';
import { ui } from '../../command';

export type CloudClient = ECRClient | IAMClient | LambdaClient | SecretsManagerClient;

export type ResourceOptions = {
  clean?: boolean;
  destroy?: boolean;
};

export type CloudResource<Client extends CloudClient, Resource, CreateCommand, UpdateCommand> = {
  client: Client;
  read: () => Promise<Resource>;
  create: (command: CreateCommand) => Promise<Resource>;
  update: (command: UpdateCommand) => Promise<Resource>;
  request: {
    create: CreateCommand;
    update?: UpdateCommand;
  };
};

const handleResource = <T>(resource: T): T => {
  if (isDebug()) {
    if (typeof resource !== 'object') {
      ui.updateBottomBarSubtext(`Managed cloud resource: ${resource}`);
      return resource;
    }
    ui.updateBottomBarSubtext(
      `Managed cloud resource: ${JSON.stringify({ ...resource, $metadata: undefined })}`,
    );
  }
  return resource;
};

const handleError = <T>(action: 'create' | 'update', retry: Promise<T>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (e: any): Promise<T> => {
    if ('$metadata' in e && 'httpStatusCode' in e.$metadata && e.$metadata.httpStatusCode === 404) {
      e = new NotFoundException(e.message, e);
    }
    if (action === 'create' && !(e instanceof NotFoundException)) {
      return retry;
    }
    if (action === 'update' && e instanceof NotFoundException) {
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
>(
  resource: CloudResource<Client, Resource, CreateCommand, UpdateCommand>,
  options: ResourceOptions,
): Promise<Resource> => {
  const { request } = resource;

  if (options.destroy) {
    throw new Error('Not implemented');
  }

  if (!request.update) {
    return resource
      .create(request.create)
      .then(handleResource)
      .catch((e) => {
        return handleError('create', resource.read())(e);
      });
  } else {
    return resource
      .update(request.update)
      .then(handleResource)
      .catch((e) => {
        return handleError('update', resource.create(request.create))(e);
      });
  }
};

export class CdCommand extends Command {}
