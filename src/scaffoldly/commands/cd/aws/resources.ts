import { CloudResource, ResourceOptions } from '..';
import { EnvProducer } from '../../ci/env';
import { GitService } from '../git';
import { ARN } from './arn';
import { IamConsumer, PolicyDocument } from './iam';
import {
  // eslint-disable-next-line import/named
  TableDescription,
  // eslint-disable-next-line import/named
  DescribeTableOutput,
  DescribeTableCommand,
  DynamoDBClient,
  CreateTableCommand,
} from '@aws-sdk/client-dynamodb';
import { SecretDeployStatus } from './secret';

export type ResourcesDeployStatus = {
  resourceArns?: string[];
  // TODO Subscriptions
};

export class ResourcesService implements IamConsumer, EnvProducer {
  private _arns: ARN<unknown>[] = [];

  private dynamoDbClient: DynamoDBClient;

  constructor(private gitService: GitService) {
    this.dynamoDbClient = new DynamoDBClient({});
  }

  public async predeploy(
    status: ResourcesDeployStatus & SecretDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev || options.buildOnly) {
      return;
    }

    await this.configureDynamoDB(status, options);

    status.resourceArns = (await Promise.all(this._arns.map((arn) => arn.arn))).reduce(
      (acc, arn) => {
        if (!arn) return acc;
        acc.push(arn);
        return acc;
      },
      [] as string[],
    );
  }

  async configureDynamoDB(status: SecretDeployStatus, options: ResourceOptions): Promise<void> {
    const tableArns = this.gitService.config.resources.filter((resource) =>
      resource.includes(':dynamodb:'),
    );

    const { uniqueId } = status;
    if (!uniqueId) {
      throw new Error('Unique ID is required for DynamoDB table creation');
    }

    const arns = tableArns.map(
      (arn) =>
        new ARN(
          arn,
          new CloudResource<{ arn: string } & TableDescription, DescribeTableOutput>(
            {
              describe: ({ arn: actualArn }) => ({
                type: 'DynamoDB Table',
                label: actualArn || arn,
              }),
              read: () =>
                this.dynamoDbClient.send(
                  new DescribeTableCommand({
                    TableName: `${ARN.resource(arn).name.split('/').pop()}-${uniqueId}`,
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
              return { arn: resource.Table?.TableArn, ...(resource.Table || {}) };
            },
          ),
          options,
        ),
    );

    this._arns.push(...arns);
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
      const region = '*';
      const { partition = '*', service, accountId = '*', resource } = arn;
      return `arn:${partition}:${service}:${region}:${accountId}:${resource}*`;
    });

    // TODO: bundle up actions from arns based on arn.hash
    const actions: string[] = this._arns
      .map((arn) => {
        const { service } = arn;
        const serviceActions: string[] = [];
        if (service === 'dynamodb') {
          serviceActions.push(...this.dynamodbActions(arn));
        }
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

  dynamodbActions(arn: ARN<unknown>): string[] {
    const { permissions } = arn;
    const actions: string[] = [];
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
    if (permissions.stream) {
      actions.push('dynamodb:*Stream*');
      actions.push('dynamodb:*Shard*');
      actions.push('dynamodb:*Records*');
    }

    return actions;
  }
}
