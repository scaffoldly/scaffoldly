import { ScaffoldlyConfig, SecretConsumer } from '../../../../config';
import {
  SecretsManagerClient,
  CreateSecretCommand,
  UpdateSecretCommand,
  DescribeSecretCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { CloudResource, manageResource, ResourceOptions } from '..';
import { NotFoundException } from './errors';
import { DeployStatus } from '.';
import { ui } from '../../../command';
import { createHash } from 'crypto';

export type SecretName = string;
export type SecretVersion = string;

export type Secret = {
  secretName: SecretName;
  uniqueId: string;
};

export type SecretDeployStatus = Partial<Secret>;

export type SecretResource = CloudResource<
  SecretsManagerClient,
  Secret,
  CreateSecretCommand,
  UpdateSecretCommand
>;

export class SecretService {
  secretsManagerClient: SecretsManagerClient;

  constructor(private config: ScaffoldlyConfig) {
    this.secretsManagerClient = new SecretsManagerClient();
  }

  public async predeploy(
    status: DeployStatus,
    consumer: SecretConsumer,
    options: ResourceOptions,
  ): Promise<DeployStatus> {
    const secretDeployStatus: SecretDeployStatus = {};

    ui.updateBottomBar('Deploying Secret');
    const { secretName, uniqueId } = await this.manageSecret(consumer.secretValue, options);

    secretDeployStatus.secretName = secretName;
    secretDeployStatus.uniqueId = uniqueId;

    return { ...status, ...secretDeployStatus };
  }

  private async manageSecret(value: Uint8Array, options: ResourceOptions): Promise<Secret> {
    const { name } = this.config;
    if (!name) {
      throw new Error('Missing name');
    }

    return manageResource(this.secretResource(name, value), options);
  }

  private secretResource(name: string, value: Uint8Array): SecretResource {
    // const secretHash = Buffer.from(value).toString('base64');

    const read = async (): Promise<Secret> => {
      return this.secretsManagerClient
        .send(new DescribeSecretCommand({ SecretId: name }))
        .then((response) => {
          const { Name, ARN } = response;
          if (!Name) {
            throw new NotFoundException('Secret not found');
          }
          if (!ARN) {
            throw new NotFoundException('Secret ARN not found');
          }

          // AWS appends a unique id to the end of the ARN.
          // It is safe to hash and use as a Unique Identifier elsewhere.
          const uniqueId = createHash('sha256').update(ARN).digest('hex').substring(0, 8);

          return {
            secretName: Name,
            uniqueId,
          } as Secret;
        })
        .catch((e) => {
          if (e.name === 'ResourceNotFoundException') {
            throw new NotFoundException('Secret not found', e);
          }
          throw e;
        });
    };

    return {
      client: this.secretsManagerClient,
      read,
      create: async (command) => this.secretsManagerClient.send(command).then(read),
      update: (command) => this.secretsManagerClient.send(command).then(read),
      request: {
        create: new CreateSecretCommand({
          Name: name,
          SecretBinary: value,
        }),
        update: new PutSecretValueCommand({
          SecretId: name,
          SecretBinary: value,
        }),
      },
    };
  }
}
