import { NO_GITHUB_CLIENT } from '../messages';
import { Scms } from '../stores/scms';
import { AwsHelper } from '../helpers/awsHelper';
import { GithubHelper } from '../helpers/githubHelper';
import { ui } from '../command';
import { event } from '../helpers/events';
import { ApiHelper } from '../helpers/apiHelper';
import { MessagesHelper } from '../helpers/messagesHelper';

export class LoginCommand {
  scms: Scms;

  awsHelper: AwsHelper;

  githubHelper: GithubHelper;

  constructor(private apiHelper: ApiHelper, private messagesHelper: MessagesHelper) {
    this.scms = new Scms(this.apiHelper);
    this.awsHelper = new AwsHelper(this.apiHelper);
    this.githubHelper = new GithubHelper(this.apiHelper, this.messagesHelper);
  }

  async handle(withToken?: string): Promise<void> {
    event('login', undefined);

    ui.updateBottomBar(`Logging into Scaffoldly...`);

    const token = this.scms.getGithubToken(withToken);
    if (!token) {
      throw new Error(NO_GITHUB_CLIENT);
    }

    return;
  }
}
