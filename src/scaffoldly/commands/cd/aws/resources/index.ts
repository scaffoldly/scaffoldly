import { ResourceOptions, Subscription } from '../..';
import { EnvProducer } from '../../../ci/env';
import { GitService } from '../../git';
import { IamConsumer, PolicyDocument } from '../iam';
import { SubscriptionProducer } from '../lambda';
import { S3Resource } from './s3';
import { DynamoDBResource } from './dynamodb';
import { AbstractResourceService, ResourcesDeployStatus } from './resource';
import { EfsResource } from './efs';
import { DsqlResource } from './dsql';

export class ResourcesService implements IamConsumer, EnvProducer, SubscriptionProducer {
  private abstractResources: AbstractResourceService[] = [];

  constructor(private gitService: GitService) {
    this.abstractResources = [
      new DynamoDBResource(this.gitService),
      new S3Resource(this.gitService),
      new EfsResource(this.gitService),
      new DsqlResource(this.gitService),
    ];
  }

  public async predeploy(status: ResourcesDeployStatus, options: ResourceOptions): Promise<void> {
    if (options.dev || options.buildOnly) {
      return;
    }

    await Promise.all(
      this.abstractResources.map((resource) => resource.configure(status, options)),
    );

    const arns = this.abstractResources.map((resource) => resource.arns).flat();

    status.resourceArns = (await Promise.all(arns.map((arn) => arn.arn))).reduce((acc, arn) => {
      if (!arn) return acc;
      acc.push(arn);
      return acc;
    }, [] as string[]);
  }

  get env(): Promise<Record<string, string>> {
    return Promise.all(this.abstractResources.map((r) => r.env)).then((envs) => {
      return envs.reduce((acc, env) => {
        return { ...acc, ...env };
      }, {} as Record<string, string>);
    });
  }

  get trustRelationship(): undefined {
    return;
  }

  get policyDocument(): PolicyDocument | undefined {
    const statements = this.abstractResources.map((r) => r.policyStatements).flat();

    if (!statements.length) {
      return;
    }

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
