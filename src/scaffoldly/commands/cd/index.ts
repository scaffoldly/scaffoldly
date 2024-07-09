import { ECRClient } from '@aws-sdk/client-ecr';
import { Command } from '../index';
import { IAMClient } from '@aws-sdk/client-iam';
import { LambdaClient } from '@aws-sdk/client-lambda';

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
): Promise<Resource | undefined> => {
  const { request } = resource;

  if (options.destroy) {
    throw new Error('Not implemented');
  }

  return (request.update ? resource.update(request.update) : resource.read()).catch((e) => {
    if (e.name === 'NotFoundException') {
      return resource.create(request.create);
    }

    throw e;
  });
};

export class CdCommand extends Command {}
