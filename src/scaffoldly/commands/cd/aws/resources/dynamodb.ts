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
import { AbstractResourceService, ResourcesDeployStatus } from './resource';

export class DynamoDBResource extends AbstractResourceService {
  private dynamoDbClient: DynamoDBClient;

  constructor(gitService: GitService) {
    super(gitService);
    this.dynamoDbClient = new DynamoDBClient({});
  }

  async configure(status: ResourcesDeployStatus, options: ResourceOptions): Promise<void> {
    const tableArns = this.gitService.config.resources.filter(
      (resource) => resource.includes(':dynamodb:') && resource.includes(':table/'),
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
                name: resource.Table?.TableName,
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

  protected createActions(arn: ARN<unknown>): string[] {
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

  protected async createSubscriptions(arn: ARN<unknown>): Promise<Subscription[]> {
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

  protected async createEnv(): Promise<Record<string, string>> {
    return {};
  }
}
