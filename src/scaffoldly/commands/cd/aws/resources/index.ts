import { ResourceOptions, Subscription } from '../..';
import { EnvProducer } from '../../../ci/env';
import { GitService } from '../../git';
import { ARN } from '../arn';
import { IamConsumer, PolicyDocument } from '../iam';
import { SecretDeployStatus } from '../secret';
import { SubscriptionProducer } from '../lambda';
import { S3Resource } from './s3';
import { DynamoDBResource } from './dynamodb';

export type ResourcesDeployStatus = {
  resourceArns?: string[];
  subscriptionArns?: string[];
};

export class ResourcesService implements IamConsumer, EnvProducer, SubscriptionProducer {
  private _arns: ARN<unknown>[] = [];

  private dynamoDbResource: DynamoDBResource;

  private s3Resource: S3Resource;

  constructor(private gitService: GitService) {
    this.dynamoDbResource = new DynamoDBResource(this.gitService);
    this.s3Resource = new S3Resource(this.gitService);
  }

  public async predeploy(
    status: ResourcesDeployStatus & SecretDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev || options.buildOnly) {
      return;
    }

    await this.dynamoDbResource.configure(status, options);
    await this.s3Resource.configure(status, options);

    this._arns = [...this.dynamoDbResource.arns, ...this.s3Resource.arns];

    status.resourceArns = (await Promise.all(this._arns.map((arn) => arn.arn))).reduce(
      (acc, arn) => {
        if (!arn) return acc;
        acc.push(arn);
        return acc;
      },
      [] as string[],
    );
  }

  get env(): Promise<Record<string, string>> {
    return Promise.all(this._arns.map((arn) => arn.env)).then((envs) => {
      return envs.reduce((acc, env) => {
        return { ...acc, ...env };
      }, {} as Record<string, string>);
    });
  }

  get trustRelationship(): undefined {
    return;
  }

  get policyDocument(): PolicyDocument | undefined {
    if (!this._arns.length) {
      return;
    }

    const resources = this._arns.map((arn) => {
      let region = '*';
      const { partition = '*', service, accountId = '*', name } = arn;
      if (service === 's3') {
        region = '';
      }
      return `arn:${partition}:${service}:${region}:${accountId}:${name}*`;
    });

    const actions: string[] = this._arns
      .map((arn) => {
        const serviceActions: string[] = [];
        serviceActions.push(...this.dynamoDbResource.createActions(arn));
        serviceActions.push(...this.s3Resource.createActions(arn));
        return serviceActions;
      })
      .flat();

    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: actions,
          Resource: resources,
        },
      ],
    };
  }

  get subscriptions(): Promise<Subscription[]> {
    return Promise.all([this.s3Resource.subscriptions, this.dynamoDbResource.subscriptions]).then(
      (subscriptions) => subscriptions.flat(),
    );
  }
}
