import {
  SecretsManagerClient,
  CreateSecretCommand,
  DescribeSecretCommand,
  PutSecretValueCommand,
  // eslint-disable-next-line import/named
  DescribeSecretCommandOutput,
} from '@aws-sdk/client-secrets-manager';
import { CloudResource, ResourceOptions } from '..';
import { NotFoundException } from '../errors';
import { createHash } from 'crypto';
import { IamConsumer, PolicyDocument } from './iam';
import { GitDeployStatus, GitService } from '../git';
import { SecretConsumer } from '../../../../config';

export type SecretName = string;
export type SecretVersion = string;

export type SecretDeployStatus = {
  secretId?: string;
  secretName?: string;
  uniqueId?: string;
};

export class SecretService implements IamConsumer {
  secretsManagerClient: SecretsManagerClient;

  lastDeployStatus?: SecretDeployStatus;

  constructor(private gitService: GitService) {
    this.secretsManagerClient = new SecretsManagerClient();
  }

  public async predeploy(
    status: SecretDeployStatus & GitDeployStatus,
    consumer: SecretConsumer,
    options: ResourceOptions,
  ): Promise<void> {
    const { name } = this.gitService.config;
    const { alias } = status;

    const secretName = `${name}@${alias}`;

    const { secretId, uniqueId } = await new CloudResource<
      { secretId: string; uniqueId: string },
      DescribeSecretCommandOutput
    >(
      {
        describe: (resource) => {
          return { type: 'Secret', label: resource.secretId };
        },
        read: () =>
          this.secretsManagerClient.send(new DescribeSecretCommand({ SecretId: secretName })),
        create: () =>
          this.secretsManagerClient.send(
            new CreateSecretCommand({ Name: secretName, SecretBinary: consumer.secretValue }),
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
          uniqueId: createHash('sha256').update(arn).digest('hex').substring(0, 8),
        };
      },
    ).manage(options);

    status.secretId = secretId;
    status.secretName = secretName;
    status.uniqueId = uniqueId;

    this.lastDeployStatus = status;
  }

  get trustRelationship(): undefined {
    return;
  }

  get policyDocument(): PolicyDocument | undefined {
    const { secretId } = this.lastDeployStatus || {};
    if (!secretId) {
      return;
    }
    return {
      Statement: [
        {
          Effect: 'Allow',
          Action: ['secretsmanager:GetSecretValue'],
          Resource: [secretId],
        },
      ],
      Version: '2012-10-17',
    };
  }
}
