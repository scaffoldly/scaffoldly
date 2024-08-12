import { NO_GITHUB_CLIENT } from '../messages';
import { Scms } from '../stores/scms';
import { AwsHelper } from '../helpers/awsHelper';
import { GithubHelper } from '../helpers/githubHelper';
import { event } from '../helpers/events';
import { ApiHelper } from '../helpers/apiHelper';
import { MessagesHelper } from '../helpers/messagesHelper';
import { GitService } from './cd/git';

export class LoginCommand {
  scms: Scms;

  awsHelper: AwsHelper;

  githubHelper: GithubHelper;

  constructor(
    private apiHelper: ApiHelper,
    private messagesHelper: MessagesHelper,
    private gitService: GitService,
  ) {
    this.scms = new Scms(this.apiHelper, this.messagesHelper, this.gitService);
    this.awsHelper = new AwsHelper(this.apiHelper);
    this.githubHelper = new GithubHelper(this.apiHelper, this.messagesHelper, this.gitService);
  }

  async handle(withToken?: string): Promise<void> {
    event('login', undefined);

    const token = await this.scms.getGithubToken(withToken);
    if (!token) {
      throw new Error(NO_GITHUB_CLIENT);
    }

    const login = await this.scms.getLogin(token);

    console.log('!!! login--TODO do something with this', login);

    return;
  }
}
