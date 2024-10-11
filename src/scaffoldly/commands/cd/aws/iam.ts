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

export type IdentityStatus = {
  accountId?: string;
  region?: string;
};

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

  public async identity(status: IdentityStatus, options: ResourceOptions): Promise<void> {
    if (options.buildOnly) {
      return;
    }

    const readIdentity = (region?: string) =>
      this.stsClient.send(new GetCallerIdentityCommand({})).finally(() => {
        if (region) {
          // We may have fallen back to us-east-1, so update the client and set env vars
          // The rest of the clients in scaffoldly use naked constructors,
          //   so this will allow the rest of them to use the desired/valid region
          //   and we won't have to check exceptions for "Region is missing" in the rest of the code
          console.warn(`🟠 Setting AWS region to "${region}"`);
          process.env.AWS_REGION = region;
          process.env.AWS_DEFAULT_REGION = region;
        }
      });

    const ensureRegion = async (region?: string) => {
      try {
        await readIdentity(region);
      } catch (e) {
        if (!region && e.message === 'Region is missing') {
          return await ensureRegion(
            process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
          );
        }
      }
    };

    // Prevent "Region is missing" error and so we can simply check credentials below
    await ensureRegion();

    const identity = await new CloudResource<
      { accountId: string; arn: string; userId: string },
      GetCallerIdentityCommandOutput
    >(
      {
        describe: (resource) => {
          return {
            type: `Identity`,
            label: resource.arn || '[computed]',
          };
        },
        read: () =>
          readIdentity().catch((e) => {
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

            if (e.name === 'CredentialsProviderError') {
              throw new Error(
                `AWS credentials are missing. Please do one of the following:
    - Run 'aws configure' to set the default credentials,
    - or: set the AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables,
    - or: set the AWS_ROLE_ARN, AWS_ROLE_SESSION_NAME, and AWS_WEB_IDENTITY_TOKEN_FILE environment variables,
    - or: set the AWS_PROFILE environment variable to select the correct profile from \`~/.aws/config\`.
    
    💡 Run with the \`show permissions\` comand to show the necessary AWS permissions
    
    📖 See: https://scaffoldly.dev/docs/cloud/aws
    
  Reason`,
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

    status.accountId = identity.accountId;
    status.region = await this.stsClient.config.region();
  }

  public async predeploy(
    status: IamDeployStatus & SecretDeployStatus,
    consumers: IamConsumer[],
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev || options.buildOnly) {
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
