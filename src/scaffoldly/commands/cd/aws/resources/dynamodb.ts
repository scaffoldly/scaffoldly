import {
  CreateTableCommand,
  DescribeTableCommand,
  // eslint-disable-next-line import/named
  DescribeTableOutput,
  DynamoDBClient,
  // eslint-disable-next-line import/named
  TableDescription,
} from '@aws-sdk/client-dynamodb';
import { ARN, ManagedArn } from '../arn';
import { CloudResource, ResourceOptions, Subscription } from '../..';
import { GitService } from '../../git';
import { SecretDeployStatus } from '../secret';
import { IamConsumer, PolicyDocument } from '../iam';
import { EnvProducer } from '../../../ci/env';
import { SubscriptionProducer } from '../lambda';

export class DynamoDBResource implements IamConsumer, EnvProducer, SubscriptionProducer {
  private _arns: ARN<unknown>[] = [];

  private dynamoDbClient: DynamoDBClient;

  constructor(private gitService: GitService) {
    this.dynamoDbClient = new DynamoDBClient({});
  }

  async configure(status: SecretDeployStatus, options: ResourceOptions): Promise<void> {
    const tableArns = this.gitService.config.resources.filter((resource) =>
      resource.includes(':dynamodb:'),
    );

    const { uniqueId } = status;

    const arns = tableArns.map(
      (arn) =>
        new ARN(
          arn,
          new CloudResource<ManagedArn & TableDescription, DescribeTableOutput>(
            {
              describe: ({ arn: actualArn }) => ({
                type: 'DynamoDB Table',
                label: actualArn || arn,
              }),
              read: (
                // TODO: id is going to be the full ARN if provided (see arn.ts)
                // we likely need to construct a new client based on the region
                id,
              ) =>
                this.dynamoDbClient.send(
                  new DescribeTableCommand({
                    TableName: id
                      ? `${ARN.resource(`${id}`).name.split('/').pop()}`
                      : `${ARN.resource(arn).name.split('/').pop()}-${uniqueId}`,
                  }),
                ),
              create: () =>
                this.dynamoDbClient.send(
                  new CreateTableCommand({
                    TableName: `${ARN.resource(arn).name.split('/').pop()}-${uniqueId}`,
                    AttributeDefinitions: [
                      // TODO: fetch these from query params
                      {
                        AttributeName: 'pk',
                        AttributeType: 'S',
                      },
                      {
                        AttributeName: 'sk',
                        AttributeType: 'S',
                      },
                    ],
                    KeySchema: [
                      {
                        AttributeName: 'pk',
                        KeyType: 'HASH',
                      },
                      {
                        AttributeName: 'sk',
                        KeyType: 'RANGE',
                      },
                    ],
                    StreamSpecification: {
                      // TODO: fetch this from query params
                      StreamEnabled: true,
                      StreamViewType: 'NEW_AND_OLD_IMAGES',
                    },
                    BillingMode: 'PAY_PER_REQUEST',
                    SSESpecification: {
                      Enabled: true,
                    },
                  }),
                ),
              update: (existing) => {
                // Don't mutate the existing table
                return Promise.resolve(existing);
              },
              emitPermissions: (aware) => {
                aware.withPermissions(['dynamodb:DescribeTable', 'dynamodb:CreateTable']);
              },
            },
            (resource) => {
              return {
                arn: resource.Table?.TableArn,
                subscriptionArn: resource.Table?.LatestStreamArn,
                ...(resource.Table || {}),
              };
            },
          ),
          options,
        ),
    );

    this._arns.push(...arns);
  }

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
        serviceActions.push(...this.createActions(arn));
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

  createActions(arn: ARN<unknown>): string[] {
    const { permissions } = arn;
    const actions: string[] = [];

    if (arn.service !== 'dynamodb') {
      return actions;
    }

    if (permissions.read) {
      actions.push(
        'dynamodb:*Scan*',
        'dynamodb:*Query*',
        'dynamodb:*Get*',
        'dynamodb:*Describe*',
        'dynamodb:*List*',
        'dynamodb:*Select*',
        'dynamodb:*Check*',
        'dyanmodb:*Export*',
      );
    }

    if (permissions.create) {
      actions.push(
        'dynamodb:*Put*',
        'dynamodb:*Create*',
        'dynamodb:*Start*',
        'dynamodb:*Import*',
        'dynamodb:*Write*',
      );
    }

    if (permissions.update) {
      actions.push(
        'dynamodb:*Update*',
        'dynamodb:*Modify*',
        'dynamodb:*Enable*',
        'dynamodb:*Restore*',
      );
    }

    if (permissions.delete) {
      actions.push('dynamodb:*Delete*', 'dynamodb:*Disable*');
    }

    if (permissions.subscribe) {
      actions.push('dynamodb:*Stream*');
      actions.push('dynamodb:*Shard*');
      actions.push('dynamodb:*Records*');
    }

    return actions;
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

  private async createSubscriptions(arn: ARN<unknown>): Promise<Subscription[]> {
    const { permissions } = arn;
    const subscriptions: Subscription[] = [];

    if (arn.service !== 'dynamodb') {
      return subscriptions;
    }

    if (!permissions.subscribe) {
      return subscriptions;
    }

    const subscriptionArn = await arn.subscriptionArn;
    if (!subscriptionArn) {
      return subscriptions;
    }

    subscriptions.push({ subscriptionArn });

    return subscriptions;
  }
}
