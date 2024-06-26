import { ScaffoldlyConfig } from '../../../../config';
import {
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  PutRolePolicyCommand,
} from '@aws-sdk/client-iam';

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

export class IamService {
  iamClient: IAMClient;
  constructor(private config: ScaffoldlyConfig) {
    this.iamClient = new IAMClient({
      region: 'us-east-1', // TODO check why env var is not being used
    });
  }

  public async getOrCreateIamRole(
    trustRelationship: TrustRelationship,
    policyDocument: PolicyDocument,
  ): Promise<{ roleArn: string }> {
    const { name } = this.config;
    if (!name) {
      throw new Error('Missing name');
    }

    const roleArn = await this.iamClient
      .send(new GetRoleCommand({ RoleName: name }))
      .then((response) => {
        return response.Role?.Arn;
      })
      .catch(async (e) => {
        if (e.name === 'NoSuchEntityException') {
          const response = await this.iamClient.send(
            new CreateRoleCommand({
              RoleName: name, // TODO Uniqueify
              AssumeRolePolicyDocument: JSON.stringify(trustRelationship),
            }),
          );
          return response.Role?.Arn;
        }
        throw e;
      });

    if (!roleArn) {
      throw new Error('Failed to create role');
    }

    await this.iamClient.send(
      new PutRolePolicyCommand({
        PolicyName: 'scaffoldly-policy',
        RoleName: name,
        PolicyDocument: JSON.stringify(policyDocument),
      }),
    );

    return { roleArn };
  }
}
