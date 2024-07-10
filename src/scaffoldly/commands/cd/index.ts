import { ECRClient } from '@aws-sdk/client-ecr';
import { Command } from '../index';
import { IAMClient } from '@aws-sdk/client-iam';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { NotFoundException } from './aws/errors';

export type CloudClient = ECRClient | IAMClient | LambdaClient;

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
    return resource.create(request.create).catch((e) => {
      if (
        '$metadata' in e &&
        'httpStatusCode' in e.$metadata &&
        e.$metadata.httpStatusCode === 404
      ) {
        e = new NotFoundException(e.message, e);
      }
      if (!(e instanceof NotFoundException)) {
        return resource.read();
      }
      throw e;
    });
  } else {
    return resource.update(request.update).catch((e) => {
      if (
        '$metadata' in e &&
        'httpStatusCode' in e.$metadata &&
        e.$metadata.httpStatusCode === 404
      ) {
        e = new NotFoundException(e.message, e);
      }
      if (e instanceof NotFoundException) {
        return resource.create(request.create);
      }
      throw e;
    });
  }
};

export class CdCommand extends Command {}
