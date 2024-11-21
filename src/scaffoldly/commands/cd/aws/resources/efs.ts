import {
  CreateAccessPointCommand,
  DescribeAccessPointsCommand,
  DescribeFileSystemsCommand,
  DescribeMountTargetsCommand,
  EFSClient,
  // eslint-disable-next-line import/named
  FileSystemDescription,
  // eslint-disable-next-line import/named
  MountTargetDescription,
} from '@aws-sdk/client-efs';
import { DescribeNetworkInterfacesCommand, EC2Client } from '@aws-sdk/client-ec2';
import { CloudResource, ResourceOptions, Subscription } from '../..';
import { GitService } from '../../git';
import { AbstractResourceService, EfsStatus, ResourcesDeployStatus, VpcStatus } from './resource';
import { ARN, ManagedArn } from '../arn';
import { join, sep } from 'path';

const parseId = (id: unknown): { fileSystemId?: string } => {
  const parts = ARN.resource(`${id}`).name.split('/');
  const fileSystemId = parts.pop();

  return {
    fileSystemId,
  };
};

const mountPath = (name?: string): string => {
  return join(sep, 'mnt', name || 'efs');
};

/**
 * TODO:
 *  - Only choose a few subnets?
 *  - Set Lambda EIPs
 *  - Optional seed "resources" with Access Point IDs, VPC IDs, Subnet IDs, and Security Group IDs
 */

export class EfsResource extends AbstractResourceService {
  private efsClient: EFSClient;

  private ec2Client: EC2Client;

  private _cacheHome?: string;

  constructor(gitService: GitService) {
    super(gitService);
    this.efsClient = new EFSClient({});
    this.ec2Client = new EC2Client({});
  }

  async configure(status: ResourcesDeployStatus, options: ResourceOptions): Promise<void> {
    await this.configureFilesystem(status, options);
  }

  async configureFilesystem(
    status: ResourcesDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    const efsArns = this.gitService.config.resources.filter(
      (resource) => resource.includes(':elasticfilesystem:') && resource.includes(':file-system/'),
    );

    const { name } = this.gitService.config;
    const { uniqueId } = status;
    // TODO: support Access Point ID from this.gitService.config.resources
    const accessPointId = `${name}-${uniqueId}`;

    const arns = await Promise.all(
      efsArns.map((arn) => {
        const { fileSystemId } = parseId(arn);

        if (fileSystemId === '.cache') {
          this._cacheHome = mountPath(fileSystemId);
        }

        return new ARN(
          arn,
          new CloudResource<ManagedArn & EfsStatus, EfsStatus & VpcStatus>(
            {
              describe: ({ arn: actualArn }) => ({
                type: 'EFS Access Point',
                label: actualArn || arn,
              }),
              read: async () => {
                return this.efsStatus(fileSystemId, accessPointId);
              },
              update: (existing) => {
                if (existing.accessPointArn) {
                  // Don't mutate the existing access point
                  return Promise.resolve(existing);
                }
                // Create an access point
                return this.efsClient.send(
                  new CreateAccessPointCommand({
                    FileSystemId: existing.fileSystemId,
                    Tags: [{ Key: 'Name', Value: accessPointId }],
                    PosixUser: {
                      Gid: 1000,
                      Uid: 1000,
                    },
                    RootDirectory: {
                      Path: join(sep, accessPointId),
                      CreationInfo: {
                        OwnerGid: 1000,
                        OwnerUid: 1000,
                        Permissions: '0755',
                      },
                    },
                  }),
                );
              },
              // TODO: create/update EFS
              emitPermissions: (aware) => {
                aware.withPermissions([
                  'elasticfilesystem:DescribeFileSystems',
                  'elasticfilesystem:DescribeAccessPoints',
                  'elasticfilesystem:CreateAccessPoint',
                  'elasticfilesystem:DescribeMountTargets',
                  'ec2:DescribeNetworkInterfaces',
                ]);
              },
            },
            (output) => {
              if (!output.fileSystemId) {
                return {};
              }

              status.efs = {
                accessPointArn: output.accessPointArn,
                fileSystemId: output.fileSystemId,
                mountPath: output.mountPath,
              };

              status.vpc = {
                vpcId: output.vpcId,
                subnetIds: output.subnetIds,
                securityGroupIds: output.securityGroupIds,
              };

              return {
                arn: output.accessPointArn,
                ...status.efs,
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
    return ['elasticfilesystem:DescribeFileSystems'];
  }

  protected async createSubscriptions(): Promise<Subscription[]> {
    return Promise.resolve([]);
  }

  private efsStatus = async (
    fileSystemId?: string,
    accessPointId?: string,
    marker?: string,
  ): Promise<EfsStatus> => {
    if (!fileSystemId) {
      return {};
    }

    const filesystems = await this.efsClient.send(
      new DescribeFileSystemsCommand({ Marker: marker }),
    );

    const fileSystem = (filesystems.FileSystems || []).find(
      (fs) => fs.FileSystemId === fileSystemId || fs.Name === fileSystemId,
    );

    if (fileSystem) {
      return this.fileSystemStatus(fileSystem, accessPointId);
    }

    if (!fileSystem && !filesystems.NextMarker) {
      throw new Error(`EFS file system not found: ${fileSystemId}`);
    }

    return this.efsStatus(fileSystemId, accessPointId, filesystems.NextMarker);
  };

  private fileSystemStatus = async (
    fileSystem: FileSystemDescription,
    accessPointId?: string,
    nextToken?: string,
  ): Promise<EfsStatus & VpcStatus> => {
    const status: EfsStatus & VpcStatus = {
      fileSystemId: fileSystem.FileSystemId,
      mountPath: mountPath(fileSystem.Name),
    };

    const accessPoints = await this.efsClient.send(
      new DescribeAccessPointsCommand({
        FileSystemId: fileSystem.FileSystemId,
        NextToken: nextToken,
      }),
    );

    const accessPoint = accessPoints.AccessPoints?.find(
      (ap) => ap.AccessPointId === accessPointId || ap.Name === accessPointId,
    );

    if (!accessPoint && accessPoints.NextToken) {
      return this.fileSystemStatus(fileSystem, accessPointId, accessPoints.NextToken);
    }

    if (!accessPoint) {
      return status;
    }

    status.accessPointArn = accessPoint.AccessPointArn;

    const mountTargets = await this.efsClient.send(
      new DescribeMountTargetsCommand({
        AccessPointId: accessPoint.AccessPointId,
      }),
    );

    if (!mountTargets.MountTargets || mountTargets.MountTargets.length === 0) {
      return status;
    }

    const vpcId = [...new Set(mountTargets.MountTargets.map((mt) => mt.VpcId))].pop();

    const networkDetails = await Promise.all(
      mountTargets.MountTargets.map(this.lookupNetworkDetail),
    );

    const subnetIds = [...new Set(networkDetails.map((nd) => nd.subnetIds).flat())].sort();
    const securityGroupIds = [
      ...new Set(networkDetails.map((nd) => nd.securityGroupIds).flat()),
    ].sort();

    return {
      ...status,
      vpcId,
      subnetIds,
      securityGroupIds,
    };
  };

  private lookupNetworkDetail = async (
    mountTarget: MountTargetDescription,
  ): Promise<{ subnetIds: string[]; securityGroupIds: string[] }> => {
    const networkInterfaceId = mountTarget.NetworkInterfaceId;
    if (!networkInterfaceId) {
      return { subnetIds: [], securityGroupIds: [] };
    }

    const networkInterfaces = await this.ec2Client.send(
      new DescribeNetworkInterfacesCommand({
        NetworkInterfaceIds: [networkInterfaceId],
      }),
    );

    // TODO: support seeding subnet IDs from resources
    const subnetIds = (networkInterfaces.NetworkInterfaces || [])
      .map((ni) => ni.SubnetId || '')
      .filter((s) => !!s);

    // TODO: support seeding security group IDs from resources
    const securityGroupIds = (networkInterfaces.NetworkInterfaces || [])
      .map((ni) => (ni.Groups || []).map((g) => g.GroupId || ''))
      .flat()
      .filter((s) => !!s);

    return {
      subnetIds,
      securityGroupIds,
    };
  };

  protected async createEnv(): Promise<Record<string, string>> {
    const env: Record<string, string> = {};
    if (this._cacheHome) {
      env.XDG_CACHE_HOME = this._cacheHome;
    }
    return Promise.resolve(env);
  }
}
