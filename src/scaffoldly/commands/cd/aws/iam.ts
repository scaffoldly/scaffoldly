import { ScaffoldlyConfig } from '../../../../config';
import {
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  PutRolePolicyCommand,
  UpdateAssumeRolePolicyCommand,
  // eslint-disable-next-line import/named
  Role,
  GetRolePolicyCommand,
} from '@aws-sdk/client-iam';
import { CloudResource, manageResource, ResourceOptions } from '..';
import { NotFoundException } from './errors';
import { DeployStatus } from '.';

export type IamDeployStatus = {
  roleArn?: string;
};

export type TrustRelationship = {
  Version: string;
  Statement: {
    Effect: 'Allow';
    Principal: {
      Service: string;
    };
    Action: 'sts:AssumeRole';
  }[];
};

export type PolicyDocument = {
  Version: string;
  Statement: {
    Effect: 'Allow';
    Action: string[];
    Resource: string[];
  }[];
};

export type RoleResource = CloudResource<
  IAMClient,
  Role,
  CreateRoleCommand,
  UpdateAssumeRolePolicyCommand
>;

export type RolePolicyResource = CloudResource<
  IAMClient,
  PolicyDocument,
  PutRolePolicyCommand,
  PutRolePolicyCommand
>;

export interface IamConsumer {
  get trustRelationship(): TrustRelationship;
  get policyDocument(): PolicyDocument;
}

export class IamService {
  iamClient: IAMClient;

  constructor(private config: ScaffoldlyConfig) {
    this.iamClient = new IAMClient();
  }

  public async deploy(
    _status: DeployStatus,
    consumer: IamConsumer,
    options: ResourceOptions,
  ): Promise<IamDeployStatus> {
    const iamStatus: IamDeployStatus = {};

    const { roleArn } = await this.manageIamRole(
      consumer.trustRelationship,
      consumer.policyDocument,
      options,
    );

    iamStatus.roleArn = roleArn;

    return iamStatus;
  }

  private async manageIamRole(
    trustRelationship: TrustRelationship,
    policyDocument: PolicyDocument,
    options: ResourceOptions,
  ): Promise<{ roleArn: string }> {
    const { name } = this.config;
    if (!name) {
      throw new Error('Missing name');
    }

    const role = await manageResource(this.roleResource(name, trustRelationship), options);

    if (!role) {
      throw new Error('Unable to create or update role');
    }

    const { Arn: roleArn } = role;

    if (!roleArn) {
      throw new Error('Missing roleArn');
    }

    await manageResource(
      this.rolePolicyResource(role, 'scaffoldly-policy', policyDocument),
      options,
    );

    return { roleArn };
  }

  private roleResource(name: string, trustRelationship: TrustRelationship): RoleResource {
    const read = async () => {
      return this.iamClient
        .send(new GetRoleCommand({ RoleName: name }))
        .then((response) => {
          if (!response.Role) {
            throw new NotFoundException('Role not found');
          }
          return response.Role;
        })
        .catch((e) => {
          if (e.name === 'NotFoundException') {
            throw new NotFoundException('Role not found', e);
          }
          throw e;
        });
    };

    return {
      client: this.iamClient,
      read,
      create: (command) => this.iamClient.send(command).then(read),
      update: (command) => this.iamClient.send(command).then(read),
      request: {
        create: new CreateRoleCommand({
          RoleName: this.config.name,
          AssumeRolePolicyDocument: JSON.stringify(trustRelationship),
        }),
        update: new UpdateAssumeRolePolicyCommand({
          RoleName: this.config.name,
          PolicyDocument: JSON.stringify(trustRelationship),
        }),
      },
    };
  }

  private rolePolicyResource(
    role: Role,
    name: string,
    policyDocument: PolicyDocument,
  ): RolePolicyResource {
    const read = async () => {
      const response = await this.iamClient.send(
        new GetRolePolicyCommand({ RoleName: role.RoleName, PolicyName: name }),
      );
      if (!response.PolicyDocument) {
        throw new NotFoundException('Policy not found');
      }
      return JSON.parse(decodeURIComponent(response.PolicyDocument)) as PolicyDocument;
    };

    const putRolePolicyCommand = new PutRolePolicyCommand({
      RoleName: role.RoleName,
      PolicyName: name,
      PolicyDocument: JSON.stringify(policyDocument),
    });

    return {
      client: this.iamClient,
      read,
      create: (command) => this.iamClient.send(command).then(read),
      update: (command) => this.iamClient.send(command).then(read),
      request: {
        create: putRolePolicyCommand,
        update: putRolePolicyCommand,
      },
    };
  }
}
