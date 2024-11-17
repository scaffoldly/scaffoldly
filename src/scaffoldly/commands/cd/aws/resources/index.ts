import { ResourceOptions, Subscription } from '../..';
import { EnvProducer } from '../../../ci/env';
import { GitService } from '../../git';
import { ARN } from '../arn';
import { IamConsumer, PolicyDocument } from '../iam';
import { SecretDeployStatus } from '../secret';
import { SubscriptionProducer } from '../lambda';
import { S3Resource } from './s3';
import { DynamoDBResource } from './dynamodb';
import { AbstractResourceService } from './resource';

export type ResourcesDeployStatus = {
  resourceArns?: string[];
  subscriptionArns?: string[];
};

export class ResourcesService implements IamConsumer, EnvProducer, SubscriptionProducer {
  private _arns: ARN<unknown>[] = [];

  private abstractResources: AbstractResourceService[] = [];

  constructor(private gitService: GitService) {
    this.abstractResources = [
      new DynamoDBResource(this.gitService),
      new S3Resource(this.gitService),
    ];
  }

  public async predeploy(
    status: ResourcesDeployStatus & SecretDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev || options.buildOnly) {
      return;
    }

    await Promise.all(
      this.abstractResources.map((resource) => resource.configure(status, options)),
    );

    this._arns = this.abstractResources.map((resource) => resource.arns).flat();

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

    const statements = this.abstractResources.map((r) => r.policyStatements).flat();

    return {
      Version: '2012-10-17',
      Statement: statements,
    };
  }

  get subscriptions(): Promise<Subscription[]> {
    return Promise.all(this.abstractResources.map((r) => r.subscriptions)).then((subscriptions) =>
      subscriptions.flat(),
    );
  }
}
