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
import { IamConsumer, PolicyDocument } from './iam';

export type SecretName = string;
export type SecretVersion = string;

export type Secret = {
  secretArn: string;
  secretName: SecretName;
  uniqueId: string;
};

export type SecretDeployStatus = Partial<Secret>;

export type SecretResource = CloudResource<
  SecretsManagerClient,
  Secret,
  CreateSecretCommand,
  UpdateSecretCommand,
  undefined
>;

export class SecretService implements IamConsumer {
  secretsManagerClient: SecretsManagerClient;

  private secretDeployStatus: SecretDeployStatus = {};

  constructor(private config: ScaffoldlyConfig) {
    this.secretsManagerClient = new SecretsManagerClient();
  }

  public async predeploy(
    status: DeployStatus,
    consumer: SecretConsumer,
    options: ResourceOptions,
  ): Promise<DeployStatus> {
    ui.updateBottomBar('Deploying Secret');
    const { secretName, uniqueId, secretArn } = await this.manageSecret(
      consumer.secretValue,
      options,
    );

    this.secretDeployStatus.secretArn = secretArn;
    this.secretDeployStatus.secretName = secretName;
    this.secretDeployStatus.uniqueId = uniqueId;

    return { ...status, ...this.secretDeployStatus };
  }

  private async manageSecret(value: Uint8Array, options: ResourceOptions): Promise<Secret> {
    const { name } = this.config;
    if (!name) {
      throw new Error('Missing name');
    }

    const secret = await manageResource(this.secretResource(name, value), options);

    const { secretArn, secretName, uniqueId } = secret;

    if (!secretArn) {
      throw new NotFoundException('Secret ARN not found');
    }

    if (!secretName) {
      throw new NotFoundException('Secret not found');
    }

    if (!uniqueId) {
      throw new NotFoundException('Secret Unique ID not found');
    }

    return { secretArn, secretName, uniqueId };
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
            secretArn: ARN,
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

  get trustRelationship(): undefined {
    return;
  }

  get policyDocument(): PolicyDocument {
    return {
      Statement: [
        {
          Effect: 'Allow',
          Action: ['secretsmanager:GetSecretValue'],
          Resource: this.secretDeployStatus.secretArn ? [this.secretDeployStatus.secretArn] : [],
        },
      ],
      Version: '2012-10-17',
    };
  }
}
