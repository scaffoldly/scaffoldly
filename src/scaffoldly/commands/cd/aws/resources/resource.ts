import { ResourceOptions, Subscription } from '../..';
import { EnvProducer } from '../../../ci/env';
import { GitService } from '../../git';
import { ARN } from '../arn';
import { PolicyStatement } from '../iam';
import { SubscriptionProducer } from '../lambda';
import { SecretDeployStatus } from '../secret';

export abstract class AbstractResourceService implements EnvProducer, SubscriptionProducer {
  protected _arns: ARN<unknown>[] = [];

  constructor(protected gitService: GitService) {}

  get arns(): ARN<unknown>[] {
    return this._arns;
  }

  get env(): Promise<Record<string, string>> {
    return Promise.all(this._arns.map((arn) => arn.env)).then((envs) => {
      return envs.reduce((acc, env) => {
        return { ...acc, ...env };
      }, {} as Record<string, string>);
    });
  }

  get subscriptions(): Promise<Subscription[]> {
    return Promise.all(
      this._arns.map(async (arn) => {
        const subscriptions: Subscription[] = [];
        subscriptions.push(...(await this.createSubscriptions(arn)));
        return subscriptions;
      }),
    ).then((results) => results.flat());
  }

  get policyStatements(): PolicyStatement[] {
    if (!this._arns.length) {
      return [];
    }

    const resources = this._arns.map((arn) => {
      let region = '*';
      const { partition = '*', service, accountId = '*', name } = arn;
      if (service === 's3') {
        region = '';
      }
      return `arn:${partition}:${service}:${region}:${accountId}:${name}*`;
    });

    const actions: string[] = this._arns.map((arn) => this.createActions(arn)).flat();

    return [
      {
        Effect: 'Allow',
        Action: actions,
        Resource: resources,
      },
    ];
  }

  abstract configure(status: SecretDeployStatus, options: ResourceOptions): Promise<void>;
  protected abstract createSubscriptions(arn: ARN<unknown>): Promise<Subscription[]>;
  protected abstract createActions(arn: ARN<unknown>): string[];
}
