import {
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  PutRolePolicyCommand,
  UpdateAssumeRolePolicyCommand,
  GetRolePolicyCommand,
  // eslint-disable-next-line import/named
  GetRoleCommandOutput,
  // eslint-disable-next-line import/named
  GetRolePolicyCommandOutput,
} from '@aws-sdk/client-iam';
import {
  GetCallerIdentityCommand,
  // eslint-disable-next-line import/named
  GetCallerIdentityCommandOutput,
  STSClient,
} from '@aws-sdk/client-sts';
import { CloudResource, ResourceOptions } from '..';
import { SecretDeployStatus } from './secret';
import { GitService } from '../git';

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
    Condition?: {
      StringEquals?: Record<string, string | string[]>;
    };
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

  stsClient: STSClient;

  constructor(private gitService: GitService) {
    this.iamClient = new IAMClient();
    this.stsClient = new STSClient();
  }

  public async identity(options: ResourceOptions): Promise<void> {
    if (options.checkPermissions) {
      // Pin to us-east-1 for permission check
      this.stsClient = new STSClient({ region: process.env.AWS_REGION || 'us-east-1' });
    }

    await new CloudResource<
      { account: string; arn: string; userId: string },
      GetCallerIdentityCommandOutput
    >(
      {
        describe: (resource) => {
          return { type: 'Identity', label: resource.arn || 'known after read' };
        },
        read: () =>
          this.stsClient.send(new GetCallerIdentityCommand({})).catch((e) => {
            if (!(e instanceof Error)) {
              throw e;
            }

            if (options.checkPermissions) {
              return {
                $metadata: {},
                Account: undefined,
                Arn: undefined,
                UserId: undefined,
              };
            }

            if (e.message === 'Region is missing' || e.name === 'CredentialsProviderError') {
              console.log('!!! e', e);
              throw new Error(
                `AWS credentials are missing. Please do one of the following:
- Run 'aws configure' to set the default credentials,
- or: set the AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables,
- or: set the AWS_PROFILE environment variable to select the correct profile,
- or: set the AWS_ROLE_ARN, AWS_ROLE_SESSION_NAME, and AWS_WEB_IDENTITY_TOKEN_FILE environment variables.

💡 Add the \`--check-permissions\` option to show the necessary AWS permissions

📖 See: https://scaffoldly.dev/docs/cloud/aws`,
                { cause: e },
              );
            }
            throw new Error('Unable to get identity', { cause: e });
          }),
      },
      (output) => {
        return {
          accountId: output.Account,
          arn: output.Arn,
          userId: output.UserId,
        };
      },
    ).manage({ ...options, checkPermissions: false });
  }

  public async predeploy(
    status: IamDeployStatus & SecretDeployStatus,
    consumers: IamConsumer[],
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev) {
      return;
    }

    const { name } = this.gitService.config;
    const { uniqueId } = status;

    const roleName = `${name}-${uniqueId || '[computed]'}`;

    const trustRelationship = mergeTrustRelationships(
      consumers.map((consumer) => consumer.trustRelationship),
    );

    const { roleArn } = await new CloudResource<
      { roleArn: string; roleName: string },
      GetRoleCommandOutput
    >(
      {
        describe: (resource) => {
          return { type: 'IAM Role', label: resource.roleName || roleName };
        },
        read: () => this.iamClient.send(new GetRoleCommand({ RoleName: roleName })),
        create: () =>
          this.iamClient.send(
            new CreateRoleCommand({
              RoleName: roleName,
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
        emitPermissions: (aware) => {
          aware.withPermissions(['iam:CreateRole', 'iam:GetRole', 'iam:UpdateAssumeRolePolicy']);
        },
      },
      (output) => {
        return {
          roleArn: output.Role?.Arn,
          roleName: output.Role?.RoleName,
        };
      },
    ).manage(options);

    status.roleArn = roleArn;

    const policyDocument = mergePolicyDocuments(
      consumers.map((consumer) => consumer.policyDocument),
    );

    await new CloudResource<{ roleName: string; policyName: string }, GetRolePolicyCommandOutput>(
      {
        describe: (resource) => {
          return { type: 'IAM Role Policy', label: resource.policyName || name };
        },
        read: () =>
          this.iamClient.send(new GetRolePolicyCommand({ RoleName: roleName, PolicyName: name })),
        create: () =>
          this.iamClient.send(
            new PutRolePolicyCommand({
              RoleName: roleName,
              PolicyName: name,
              PolicyDocument: JSON.stringify(policyDocument),
            }),
          ),
        update: () =>
          this.iamClient.send(
            new PutRolePolicyCommand({
              RoleName: roleName,
              PolicyName: name,
              PolicyDocument: JSON.stringify(policyDocument),
            }),
          ),
        emitPermissions: (aware) => {
          aware.withPermissions(['iam:PutRolePolicy', 'iam:GetRolePolicy']);
        },
      },
      (output) => {
        return {
          roleName: output.RoleName,
          policyName: output.PolicyName,
        };
      },
    ).manage(options);
  }
}
