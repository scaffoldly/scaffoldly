import { CloudResource, ResourceOptions, Subscription } from '..';
import { EnvProducer } from '../../ci/env';
import { GitService } from '../git';
import { ARN, ManagedArn } from './arn';
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
import {
  S3Client,
  // eslint-disable-next-line import/named
  CreateBucketCommand,
  HeadBucketCommand,
  HeadBucketOutput,
  GetBucketNotificationConfigurationCommand,
  NotificationConfiguration,
  PutBucketNotificationConfigurationCommand,
} from '@aws-sdk/client-s3';
import { SecretDeployStatus } from './secret';
import { SubscriptionProducer } from './lambda';

export type ResourcesDeployStatus = {
  resourceArns?: string[];
  subscriptionArns?: string[];
};

export class ResourcesService implements IamConsumer, EnvProducer, SubscriptionProducer {
  private _arns: ARN<unknown>[] = [];

  private dynamoDbClient: DynamoDBClient;

  private s3Client: S3Client;

  constructor(private gitService: GitService) {
    this.dynamoDbClient = new DynamoDBClient({});
    this.s3Client = new S3Client({});
  }

  public async predeploy(
    status: ResourcesDeployStatus & SecretDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev || options.buildOnly) {
      return;
    }

    await this.configureDynamoDB(status, options);
    await this.configureS3(status, options);

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

  async configureS3(status: SecretDeployStatus, options: ResourceOptions): Promise<void> {
    const bucketArns = this.gitService.config.resources.filter((resource) =>
      resource.includes(':s3:'),
    );

    const { uniqueId } = status;

    const arns = await Promise.all(
      bucketArns.map(
        (arn) =>
          new ARN(
            arn,
            new CloudResource<ManagedArn, HeadBucketOutput & { Bucket: string }>(
              {
                describe: ({ arn: actualArn }) => ({
                  type: 'S3 Bucket',
                  label: actualArn || arn,
                }),
                read: async (id) => {
                  const bucket = id
                    ? `${ARN.resource(`${id}`).name.split('/').pop()}`
                    : `${ARN.resource(arn).name.split('/').pop()}-${uniqueId}`;
                  return this.s3Client
                    .send(
                      new HeadBucketCommand({
                        Bucket: bucket,
                      }),
                    )
                    .then((output) => {
                      return {
                        Bucket: bucket,
                        ...output,
                      };
                    });
                },
                create: () =>
                  this.s3Client
                    .send(
                      new CreateBucketCommand({
                        Bucket: `${ARN.resource(arn).name.split('/').pop()}-${uniqueId}`,
                      }),
                    )
                    .then((created) => {
                      return created;
                    }),
                update: (existing) => {
                  // Don't mutate the existing bucket
                  return Promise.resolve(existing);
                },
                emitPermissions: (aware) => {
                  aware.withPermissions(['s3:HeadBucket', 's3:CreateBucket']);
                },
              },
              (output) => {
                if (!output) {
                  return undefined;
                }
                if (!output.BucketRegion) {
                  return undefined;
                }
                if (!output.Bucket) {
                  return undefined;
                }
                return {
                  // TODO: infer partition from region
                  arn: `arn:aws:s3:::${output.Bucket}`,
                };
              },
            ),
            options,
          ),
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
        serviceActions.push(...this.dynamodbActions(arn));
        serviceActions.push(...this.s3Actions(arn));
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

  s3Actions(arn: ARN<unknown>): string[] {
    const { permissions } = arn;
    const actions: string[] = [];

    if (arn.service !== 's3') {
      return actions;
    }

    if (permissions.read) {
      actions.push('s3:Get*');
      actions.push('s3:List*');
      actions.push('s3:Describe*');
    }

    if (permissions.create) {
      actions.push('s3:Put*');
      actions.push('s3:Create*');
    }

    if (permissions.update) {
      actions.push('s3:Abort*');
      actions.push('s3:Update*');
      actions.push('s3:Restore*');
      actions.push('s3:Replicate*');
    }

    if (permissions.delete) {
      actions.push('s3:Delete*');
    }

    if (permissions.subscribe) {
      // Nothing
    }

    return actions;
  }

  get subscriptions(): Promise<Subscription[]> {
    return Promise.all(
      this._arns.map(async (arn) => {
        const subscriptions: Subscription[] = [];
        subscriptions.push(...(await this.dynamodbSubscriptions(arn)));
        subscriptions.push(...(await this.s3Subscriptions(arn)));
        return subscriptions;
      }),
    ).then((results) => results.flat());
  }

  async dynamodbSubscriptions(arn: ARN<unknown>): Promise<Subscription[]> {
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

  async s3Subscriptions(arn: ARN<unknown>): Promise<Subscription[]> {
    const { permissions } = arn;
    const subscriptions: Subscription[] = [];

    if (arn.service !== 's3') {
      return subscriptions;
    }

    const bucketArn = await arn.arn;

    if (!bucketArn) {
      return subscriptions;
    }

    const bucket = ARN.resource(bucketArn).name.split('/').pop();
    if (!bucket) {
      return subscriptions;
    }

    subscriptions.push({
      createSubscription: (destinationArn: string) =>
        new CloudResource<
          Subscription & NotificationConfiguration & { destination?: string },
          NotificationConfiguration & { source?: string; destination?: string; service?: string }
        >(
          {
            describe: (existing) => ({
              type: 'S3 Subscription',
              label: `${bucket} (lambda: ${!!existing.LambdaFunctionConfigurations?.find(
                (c) => c.LambdaFunctionArn === destinationArn,
              )})`,
            }),
            read: async () => {
              const source = await arn.subscriptionArn;
              return this.s3Client
                .send(new GetBucketNotificationConfigurationCommand({ Bucket: bucket }))
                .then((output) => {
                  return {
                    source,
                    destination: destinationArn,
                    service: ARN.resource(destinationArn).service,
                    ...output,
                  };
                });
            },
            update: (existing) => {
              if (ARN.resource(destinationArn).service === 'lambda') {
                // TODO: Cleanup and make generic helper functions for this
                existing.LambdaFunctionConfigurations = existing.LambdaFunctionConfigurations || [];
                if (permissions.subscribe) {
                  const ix = existing.LambdaFunctionConfigurations.findIndex(
                    (e) => e.Id === destinationArn,
                  );
                  if (ix === -1) {
                    existing.LambdaFunctionConfigurations.push({
                      Id: destinationArn,
                      LambdaFunctionArn: destinationArn,
                      Events: ['s3:ObjectCreated:*', 's3:ObjectRemoved:*', 's3:ObjectRestore:*'],
                    });
                  } else {
                    existing.LambdaFunctionConfigurations[ix] = {
                      Id: destinationArn,
                      LambdaFunctionArn: destinationArn,
                      Events: ['s3:ObjectCreated:*', 's3:ObjectRemoved:*', 's3:ObjectRestore:*'],
                    };
                  }
                } else {
                  existing.LambdaFunctionConfigurations =
                    existing.LambdaFunctionConfigurations?.filter((e) => e.Id !== destinationArn);
                }
              }

              return this.s3Client.send(
                new PutBucketNotificationConfigurationCommand({
                  Bucket: bucket,
                  SkipDestinationValidation: true,
                  NotificationConfiguration: {
                    EventBridgeConfiguration: existing.EventBridgeConfiguration,
                    LambdaFunctionConfigurations: existing.LambdaFunctionConfigurations,
                    QueueConfigurations: existing.QueueConfigurations,
                    TopicConfigurations: existing.TopicConfigurations,
                  },
                }),
              );
            },

            emitPermissions: (aware) => {
              aware.withPermissions([
                's3:GetBucketNotificationConfiguration',
                's3:PutBucketNotificationConfiguration',
              ]);
            },
          },
          (output) => {
            let subscriptionArn: string | undefined = undefined;

            if (output.service === 'lambda') {
              if (
                output.LambdaFunctionConfigurations?.find(
                  (c) => c.LambdaFunctionArn === output.destination,
                )
              ) {
                subscriptionArn = output.source;
              }
            }

            return {
              subscriptionArn,
              destination: output.destination,
              ...output,
            };
          },
        ),
      lambdaPermission: async (functionArn?: string) => {
        if (!functionArn) {
          return;
        }
        return {
          FunctionName: `${functionArn}`,
          StatementId: `S3-InvokeFunction-${bucket}`,
          Action: 'lambda:InvokeFunction',
          Principal: 's3.amazonaws.com',
          SourceArn: await arn.arn,
        };
      },
    });

    return subscriptions;
  }
}
