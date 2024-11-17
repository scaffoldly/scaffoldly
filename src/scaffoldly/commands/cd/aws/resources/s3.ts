import {
  CreateBucketCommand,
  GetBucketNotificationConfigurationCommand,
  HeadBucketCommand,
  // eslint-disable-next-line import/named
  HeadBucketOutput,
  // eslint-disable-next-line import/named
  NotificationConfiguration,
  PutBucketNotificationConfigurationCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { EnvProducer } from '../../../ci/env';
import { SubscriptionProducer } from '../lambda';
import { SecretDeployStatus } from '../secret';
import { CloudResource, ResourceOptions, Subscription } from '../..';
import { ARN, ManagedArn } from '../arn';
import { GitService } from '../../git';

export class S3Resource implements EnvProducer, SubscriptionProducer {
  private _arns: ARN<unknown>[] = [];

  private s3Client: S3Client;

  constructor(private gitService: GitService) {
    this.s3Client = new S3Client({});
  }

  async configure(status: SecretDeployStatus, options: ResourceOptions): Promise<void> {
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

  private async createSubscriptions(arn: ARN<unknown>): Promise<Subscription[]> {
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

  createActions(arn: ARN<unknown>): string[] {
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
}
