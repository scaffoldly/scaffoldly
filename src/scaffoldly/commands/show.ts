import { event } from '../helpers/events';
import { ApiHelper } from '../helpers/apiHelper';
import { Scms } from '../stores/scms';
import { AwsHelper } from '../helpers/awsHelper';
import { ui } from '../command';
import { MessagesHelper } from '../helpers/messagesHelper';
import { GitService } from './cd/git';

export type ShowSubcommands = 'identity';

export type OutputType = 'table' | 'json';

export type IdentityResponse = {
  github?: {
    identity: string;
  };
  aws?: {
    identity: string;
  };
};

export class ShowCommand {
  gitService: GitService;

  scms: Scms;

  awsHelper: AwsHelper;

  constructor(private apiHelper: ApiHelper, private messagesHelper: MessagesHelper) {
    this.gitService = new GitService(process.cwd());
    this.scms = new Scms(this.apiHelper, this.messagesHelper, this.gitService);
    this.awsHelper = new AwsHelper(this.apiHelper);
  }

  public async handle(
    subcommand: ShowSubcommands,
    withToken?: string,
    output: 'table' | 'json' = 'table',
  ): Promise<void> {
    switch (subcommand) {
      case 'identity': {
        event('show', subcommand);
        return this.showIdentity(withToken, output);
      }
      default:
        break;
    }

    throw new Error(`Unknown subcommand: ${subcommand}`);
  }

  public async fetchIdentity(withToken?: string): Promise<IdentityResponse> {
    const githubToken = await this.scms.getGithubToken(withToken);
    const identityResponse: IdentityResponse = {};

    if (githubToken) {
      identityResponse.github = {
        identity: await this.scms.getLogin(githubToken),
      };
    }

    const awsIdentity = await this.awsHelper.currentIdentity();
    if (awsIdentity) {
      identityResponse.aws = {
        identity: awsIdentity,
      };
    }

    return identityResponse;
  }

  private async showIdentity(withToken?: string, output?: string): Promise<void> {
    const identity = await this.fetchIdentity(withToken);

    ui.updateBottomBar('');
    if (output === 'json') {
      console.log(JSON.stringify(identity, null, 2));
    } else {
      console.table(identity);
    }
  }
}
