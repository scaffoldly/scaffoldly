import {
  // eslint-disable-next-line import/named
  ClusterSummary,
  CreateClusterCommand,
  DSQLClient,
  GetClusterCommand,
  ListClustersCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-dsql';
import { CloudResource, ResourceOptions, Subscription } from '../..';
import { GitService } from '../../git';
import { AbstractResourceService, DsqlStatus, ResourcesDeployStatus } from './resource';
import { ARN, ManagedArn } from '../arn';
import promiseRetry from 'promise-retry';
import { FatalException } from '../../errors';
import { ScaffoldlyConfig } from '../../../../../config';

const generateClusterName = (arn: unknown, config: ScaffoldlyConfig, uniqueId?: string): string => {
  const resource = ARN.resource(`${arn}`);
  const parts = resource.name.split('/');

  const clusterId = parts.pop();

  if (resource.partition && clusterId) {
    // Partition is set so the cluster already exists
    return clusterId;
  }

  const { name: serviceName } = config;

  if (clusterId) {
    return `${serviceName}-${uniqueId}-${clusterId}`;
  } else {
    return `${serviceName}-${uniqueId}`;
  }
};

/*
TODO:
 - Make clever way of generating password
*/

export class DsqlResource extends AbstractResourceService {
  private dsqlClient: DSQLClient;

  constructor(gitService: GitService) {
    super(gitService);
    this.dsqlClient = new DSQLClient({});
  }

  async configure(status: ResourcesDeployStatus, options: ResourceOptions): Promise<void> {
    await this.configureDsql(status, options);
  }

  async configureDsql(status: ResourcesDeployStatus, options: ResourceOptions): Promise<void> {
    const dsqlArns = this.gitService.config.resources.filter(
      (resource) => resource.includes(':dsql:') && resource.includes(':cluster/'),
    );

    const arns = await Promise.all(
      dsqlArns.map((arn) => {
        const clusterName = generateClusterName(arn, this.gitService.config, status.uniqueId);
        return new ARN(
          arn,
          new CloudResource<ManagedArn & DsqlStatus, DsqlStatus>(
            {
              describe: ({ arn: actualArn }) => ({
                type: 'DSQL Cluster',
                label: actualArn || arn,
              }),
              read: () => this.dsqlStatus(clusterName),
              update: (existing) => {
                if (existing.dsqlArn) {
                  // Don't mutate the existing access point
                  return Promise.resolve(existing);
                }
                // Create an Dsql cluster
                return this.dsqlClient.send(
                  new CreateClusterCommand({
                    tags: { Name: clusterName },
                  }),
                );
              },
              emitPermissions: (aware) => {
                aware.withPermissions([
                  'dsql:List*',
                  'dsql:Get*',
                  'dsql:Update*',
                  'dsql:Create*',
                  'dsql:Delete*',
                  'dsql:*Tag*',
                ]);
              },
            },
            (output) => {
              if (!output.dsqlId) {
                return {};
              }

              return {
                dsqlArn: output.dsqlArn,
                dsqlUrl: output.dsqlUrl,
                dsqlId: output.dsqlId,
                arn: output.dsqlArn,
                name: output.dsqlId,
                env: {
                  URL: output.dsqlUrl,
                },
              };
            },
          ),
          options,
        );
      }),
    );

    this._arns.push(...arns);

    return;
  }

  protected createActions(): string[] {
    return ['dsql:DbConnect*'];
  }

  protected async createSubscriptions(): Promise<Subscription[]> {
    return Promise.resolve([]);
  }

  private dsqlStatus = async (clusterName?: string, marker?: string): Promise<DsqlStatus> => {
    if (!clusterName) {
      return {};
    }

    const status = await promiseRetry(
      async (retry) => {
        const foo = await this.dsqlClient
          .send(new GetClusterCommand({ identifier: clusterName }))
          .then((c) => {
            if (!c.arn) {
              return undefined;
            }

            const region = ARN.resource(c.arn).region;
            if (!region) {
              return undefined;
            }

            if (c.status === 'ACTIVE') {
              return {
                dsqlId: c.identifier,
                dsqlArn: c.arn,
                dsqlUrl: `postgresql://admin@${c.identifier}.dsql.${region}.on.aws:5432/postgres?sslmode=require`,
              } as DsqlStatus;
            }

            if (c.status !== 'CREATING') {
              throw new FatalException(`DSQL Cluster is ${c.status}`);
            }

            return retry(new Error('DSQL Cluster is still creating'));
          })
          .catch((e) => {
            if (
              e.$metadata &&
              (e.$metadata.httpStatusCode === 404 || e.$metadata.httpStatusCode === 400)
            ) {
              return undefined;
            }

            throw e;
          });

        return foo;
      },
      { forever: true, minTimeout: 1000, maxTimeout: 5000 },
    );

    if (status) {
      return status;
    }

    return this.dsqlClient
      .send(new ListClustersCommand({ nextToken: marker }))
      .then(({ clusters = [], nextToken }) =>
        clusters.reduce(async (accP, cluster) => {
          const acc = await accP;
          if (acc.cluster) {
            return acc;
          }

          const { tags = {} } = await this.dsqlClient.send(
            new ListTagsForResourceCommand({ resourceArn: cluster.arn }),
          );

          if (tags.Name === clusterName) {
            return { cluster };
          }

          return { cluster: undefined, nextToken };
        }, Promise.resolve({} as { cluster?: ClusterSummary; nextToken?: string })),
      )
      .then(({ cluster, nextToken }) => {
        if (cluster) {
          return this.dsqlStatus(cluster.identifier);
        }
        if (nextToken) {
          return this.dsqlStatus(clusterName, nextToken);
        }
        return {};
      });
  };

  protected async createEnv(): Promise<Record<string, string>> {
    const env: Record<string, string> = {};
    return Promise.resolve(env);
  }
}
