import { ScaffoldlyConfig, SecretConsumer } from '../../../../config';
import {
  SecretsManagerClient,
  CreateSecretCommand,
  DescribeSecretCommand,
  PutSecretValueCommand,
  // eslint-disable-next-line import/named
  DescribeSecretCommandOutput,
} from '@aws-sdk/client-secrets-manager';
import { CloudResource, ResourceOptions } from '..';
import { NotFoundException } from './errors';
import { DeployStatus } from '.';
import { createHash } from 'crypto';
import { IamConsumer, PolicyDocument } from './iam';

export type SecretName = string;
export type SecretVersion = string;

export type SecretDeployStatus = {
  secretId?: string;
  secretName?: string;
  uniqueId?: string;
};

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
    const { name } = this.config;

    const { secretId, secretName, uniqueId } = await new CloudResource<
      { secretId: string; secretName: string; uniqueId: string },
      DescribeSecretCommandOutput
    >(
      {
        describe: (resource) => {
          return { type: 'Secret', label: resource.secretName };
        },
        read: () => this.secretsManagerClient.send(new DescribeSecretCommand({ SecretId: name })),
        create: () =>
          this.secretsManagerClient.send(
            new CreateSecretCommand({ Name: name, SecretBinary: consumer.secretValue }),
          ),
        update: (existing) =>
          this.secretsManagerClient.send(
            new PutSecretValueCommand({
              SecretId: existing.secretId,
              SecretBinary: consumer.secretValue,
            }),
          ),
      },
      (output) => {
        const arn = output.ARN;
        if (!arn) {
          throw new NotFoundException('Secret ARN not found');
        }
        return {
          secretId: output.ARN,
          secretName: output.Name,
          uniqueId: createHash('sha256').update(arn).digest('hex').substring(0, 8),
        };
      },
    ).manage(options);

    this.secretDeployStatus.secretId = secretId;
    this.secretDeployStatus.secretName = secretName;
    this.secretDeployStatus.uniqueId = uniqueId;

    return { ...status, ...this.secretDeployStatus };
  }

  get trustRelationship(): undefined {
    return;
  }

  get policyDocument(): PolicyDocument | undefined {
    if (!this.secretDeployStatus.secretId) {
      return;
    }
    return {
      Statement: [
        {
          Effect: 'Allow',
          Action: ['secretsmanager:GetSecretValue'],
          Resource: [this.secretDeployStatus.secretId],
        },
      ],
      Version: '2012-10-17',
    };
  }
}
