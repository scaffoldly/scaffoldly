import {
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
import { NotFoundException } from '../../errors';
import { join, sep } from 'path';

const parseId = (id: unknown): { fileSystemId?: string } => {
  const parts = ARN.resource(`${id}`).name.split('/');
  const fileSystemId = parts.pop();

  return {
    fileSystemId,
  };
};

/**
 * TODO:
 *  - Mount The EFS at /mnt/efs/{tag:Name}
 *  - Create an Access Point instead of looking up
 *  - Only choose a few subnets?
 *  - Set Lambda EIPs
 *  - Optional seed "resources" with Access Point IDs, VPC IDs, Subnet IDs, and Security Group IDs
 */

export class EfsResource extends AbstractResourceService {
  private _env: Record<string, string> = {};

  private efsClient: EFSClient;

  private ec2Client: EC2Client;

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

    const arns = await Promise.all(
      efsArns.map(
        (arn) =>
          new ARN(
            arn,
            new CloudResource<ManagedArn, EfsStatus & VpcStatus>(
              {
                describe: ({ arn: actualArn }) => ({
                  type: 'EFS Access Point',
                  label: actualArn || arn,
                }),
                read: async () => {
                  const { fileSystemId } = parseId(arn);
                  return this.efsStatus(fileSystemId);
                },
                // TODO: create/update EFS
                emitPermissions: (aware) => {
                  aware.withPermissions([
                    'elasticfilesystem:DescribeFileSystems',
                    'elasticfilesystem:DescribeAccessPoints',
                    'elasticfilesystem:DescribeMountTargets',
                    'ec2:DescribeNetworkInterfaces',
                  ]);
                },
              },
              (output) => {
                if (!output.fileSystem) {
                  return {};
                }

                if (output.fileSystemName === 'cache') {
                  output.fileSystemName = 'efs';
                  this._env.XDG_CACHE_HOME = join(sep, 'mnt', output.fileSystemName, `.cache`);
                }

                status.efs = {
                  accessPoint: output.accessPoint,
                  fileSystem: output.fileSystem,
                  fileSystemName: output.fileSystemName,
                };

                status.vpc = {
                  vpcId: output.vpcId,
                  subnetIds: output.subnetIds,
                  securityGroupIds: output.securityGroupIds,
                };

                return {
                  arn: output.accessPoint,
                };
              },
            ),
            options,
          ),
      ),
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

  private efsStatus = async (fileSystemId?: string, marker?: string): Promise<EfsStatus> => {
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
      return this.fileSystemStatus(fileSystem);
    }

    if (!filesystems.NextMarker) {
      throw new NotFoundException(`Unable to find an EFS file system: ${name}`);
    }

    return this.efsStatus(fileSystemId, filesystems.NextMarker);
  };

  private fileSystemStatus = async (
    fileSystem: FileSystemDescription,
  ): Promise<EfsStatus & VpcStatus> => {
    const accessPoints = await this.efsClient.send(
      new DescribeAccessPointsCommand({ FileSystemId: fileSystem.FileSystemId }),
    );

    if (!accessPoints.AccessPoints || accessPoints.AccessPoints.length === 0) {
      return {};
    }

    if (accessPoints.AccessPoints.length > 1) {
      // TODO Support AP Seeding in resources
      throw new Error(`Multiple access points found for EFS ${fileSystem.FileSystemId}`);
    }

    const accessPoint = accessPoints.AccessPoints[0];

    const mountTargets = await this.efsClient.send(
      new DescribeMountTargetsCommand({
        AccessPointId: accessPoint.AccessPointId,
      }),
    );

    if (!mountTargets.MountTargets || mountTargets.MountTargets.length === 0) {
      return {};
    }

    const vpcIds = [...new Set(mountTargets.MountTargets.map((mt) => mt.VpcId))];

    if (vpcIds.length > 1) {
      // TODO Support VPC Seeding in resources
      throw new Error(`Multiple VPCs found for EFS ${fileSystem.FileSystemId}`);
    }

    const vpcId = vpcIds[0];
    const networkDetails = await Promise.all(
      mountTargets.MountTargets.map(this.lookupNetworkDetail),
    );

    const subnetIds = [...new Set(networkDetails.map((nd) => nd.subnetIds).flat())];
    const securityGroupIds = [...new Set(networkDetails.map((nd) => nd.securityGroupIds).flat())];

    return {
      fileSystem: fileSystem.FileSystemArn,
      accessPoint: accessPoint.AccessPointArn,
      fileSystemName: fileSystem.Name,
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

    const subnetIds = (networkInterfaces.NetworkInterfaces || [])
      .map((ni) => ni.SubnetId || '')
      .filter((s) => !!s);

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
    return this._env;
  }
}
