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
import { EnvProducer, EnvService } from '../../ci/env';

export type SecretName = string;
export type SecretVersion = string;

export type SecretDeployStatus = {
  secretId?: string;
  secretName?: string;
  uniqueId?: string;
};

export class SecretService implements IamConsumer, EnvProducer {
  secretsManagerClient: SecretsManagerClient;

  private _secretId?: string;

  constructor(private gitService: GitService, private envService: EnvService) {
    this.secretsManagerClient = new SecretsManagerClient();
  }

  public async predeploy(
    status: SecretDeployStatus & GitDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev || options.buildOnly) {
      return;
    }

    const { name } = this.gitService.config;
    const { alias } = status;

    const secretName = `${name}@${alias}`;

    const { secretId, uniqueId } = await new CloudResource<
      { secretId: string; uniqueId: string },
      DescribeSecretCommandOutput
    >(
      {
        describe: (resource) => {
          return { type: 'Secret', label: resource.secretId || secretName };
        },
        read: () =>
          this.secretsManagerClient
            .send(new DescribeSecretCommand({ SecretId: secretName }))
            .then((output) => {
              this._secretId = output.ARN;
              return output;
            }),
        create: () =>
          this.envService.secretEnv.then((secretEnv) =>
            this.secretsManagerClient.send(
              new CreateSecretCommand({
                Name: secretName,
                SecretBinary: Uint8Array.from(Buffer.from(JSON.stringify(secretEnv), 'utf-8')),
              }),
            ),
          ),
        emitPermissions: (aware) => {
          aware.withPermissions(['secretsmanager:CreateSecret', 'secretsmanager:DescribeSecret']);
        },
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
  }

  public async deploy(
    status: SecretDeployStatus & GitDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev || options.buildOnly) {
      return;
    }

    await new CloudResource<{ secretId: string; uniqueId: string }, DescribeSecretCommandOutput>(
      {
        describe: (resource) => {
          return { type: 'Secret', label: resource.secretId || '[computed]' };
        },
        read: () =>
          this.secretsManagerClient.send(
            new DescribeSecretCommand({ SecretId: status.secretName }),
          ),
        update: () =>
          this.envService.secretEnv.then((secretEnv) =>
            this.secretsManagerClient.send(
              new PutSecretValueCommand({
                SecretId: status.secretId,
                SecretBinary: Uint8Array.from(Buffer.from(JSON.stringify(secretEnv), 'utf-8')),
              }),
            ),
          ),
        emitPermissions: (aware) => {
          aware.withPermissions(['secretsmanager:CreateSecret', 'secretsmanager:DescribeSecret']);
        },
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
  }

  get env(): Promise<Record<string, string>> {
    return Promise.resolve({
      SLY_SECRET: this._secretId || '',
    });
  }

  get trustRelationship(): undefined {
    return;
  }

  get policyDocument(): PolicyDocument | undefined {
    if (!this._secretId) {
      return;
    }
    return {
      Statement: [
        {
          Effect: 'Allow',
          Action: ['secretsmanager:GetSecretValue'],
          Resource: [this._secretId],
        },
      ],
      Version: '2012-10-17',
    };
  }
}
