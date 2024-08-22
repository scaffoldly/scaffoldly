import { GitService } from '../git';
import { IamConsumer, PolicyDocument } from './iam';

export class DynamoDbService implements IamConsumer {
  constructor(private gitService: GitService) {}

  get tableArns(): string[] {
    return this.gitService.config.resources.filter(
      (resource) => resource.indexOf(':dynamodb:') !== -1,
    );
  }

  get trustRelationship(): undefined {
    return;
  }

  get policyDocument(): PolicyDocument | undefined {
    if (!this.tableArns.length) {
      return;
    }
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['dynamodb:*'], // TODO: find a way to make this readonly/readwrite, potentially suffix arns with #rw or #ro
          Resource: this.tableArns,
        },
      ],
    };
  }
}
