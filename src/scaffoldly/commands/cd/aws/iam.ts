import promiseRetry from 'promise-retry';
import { ScaffoldlyConfig } from '../../../../config';
import {
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  PutRolePolicyCommand,
  UpdateAssumeRolePolicyCommand,
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

    const roleArn = await promiseRetry(
      async (retry) => {
        return this.iamClient
          .send(
            new UpdateAssumeRolePolicyCommand({
              RoleName: name,
              PolicyDocument: JSON.stringify(trustRelationship),
            }),
          )
          .then(async () => {
            const response = await this.iamClient.send(new GetRoleCommand({ RoleName: name }));
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
          })
          .then((arn) => {
            if (!arn) {
              return retry(new Error(`Timed out waiting for role ${name} to exist`));
            }
            return arn;
          });
      },
      { factor: 1, retries: 60 },
    );

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
