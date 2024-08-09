import { ScaffoldlyConfig } from '../../../../config';
import {
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  PutRolePolicyCommand,
  UpdateAssumeRolePolicyCommand,
  GetRolePolicyCommand,
  GetRoleCommandOutput,
  GetRolePolicyCommandOutput,
} from '@aws-sdk/client-iam';
import { CloudResource, ResourceOptions } from '..';
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

const mergeTrustRelationships = (
  trustRelationships: (TrustRelationship | undefined)[],
): TrustRelationship => {
  return {
    Version: '2012-10-17',
    Statement: trustRelationships
      .flatMap((trustRelationship) => trustRelationship?.Statement)
      .filter((statement) => !!statement),
  };
};

export type PolicyDocument = {
  Version: string;
  Statement: {
    Sid?: string;
    Effect: 'Allow';
    Action: string[];
    Resource: string[];
  }[];
};

const mergePolicyDocuments = (policyDocuments: (PolicyDocument | undefined)[]): PolicyDocument => {
  return {
    Version: '2012-10-17',
    Statement: policyDocuments
      .flatMap((policyDocument) => policyDocument?.Statement)
      .filter((statement) => !!statement),
  };
};

export interface IamConsumer {
  get trustRelationship(): TrustRelationship | undefined;
  get policyDocument(): PolicyDocument | undefined;
}

export class IamService {
  iamClient: IAMClient;

  constructor(private config: ScaffoldlyConfig) {
    this.iamClient = new IAMClient();
  }

  public async predeploy(
    status: DeployStatus,
    consumers: IamConsumer[],
    options: ResourceOptions,
  ): Promise<DeployStatus> {
    const iamDeployStatus: IamDeployStatus = {};

    const { name } = this.config;

    const trustRelationship = mergeTrustRelationships(
      consumers.map((consumer) => consumer.trustRelationship),
    );

    const { roleArn } = await new CloudResource<
      { roleArn: string; roleName: string },
      GetRoleCommandOutput
    >(
      {
        describe: (existing) => `Role: ${existing.roleName}`,
        read: () => this.iamClient.send(new GetRoleCommand({ RoleName: name })),
        create: () =>
          this.iamClient.send(
            new CreateRoleCommand({
              RoleName: name,
              AssumeRolePolicyDocument: JSON.stringify(trustRelationship),
            }),
          ),
        update: (existing) =>
          this.iamClient.send(
            new UpdateAssumeRolePolicyCommand({
              RoleName: existing.roleName,
              PolicyDocument: JSON.stringify(trustRelationship),
            }),
          ),
      },
      (output) => {
        return {
          roleArn: output.Role?.Arn,
          roleName: output.Role?.RoleName,
        };
      },
    ).manage(options);

    iamDeployStatus.roleArn = roleArn;

    const policyDocument = mergePolicyDocuments(
      consumers.map((consumer) => consumer.policyDocument),
    );

    await new CloudResource<{ roleName: String; policyName: string }, GetRolePolicyCommandOutput>(
      {
        describe: (existing) => `Role Policy: ${existing.policyName} (on ${existing.roleName})`,
        read: () =>
          this.iamClient.send(new GetRolePolicyCommand({ RoleName: name, PolicyName: name })),
        create: () =>
          this.iamClient.send(
            new PutRolePolicyCommand({
              RoleName: name,
              PolicyName: name,
              PolicyDocument: JSON.stringify(policyDocument),
            }),
          ),
        update: () =>
          this.iamClient.send(
            new PutRolePolicyCommand({
              RoleName: name,
              PolicyName: name,
              PolicyDocument: JSON.stringify(policyDocument),
            }),
          ),
      },
      (output) => {
        return {
          roleName: output.RoleName,
          policyName: output.PolicyName,
        };
      },
    ).manage(options);

    return { ...status, ...iamDeployStatus };
  }
}
