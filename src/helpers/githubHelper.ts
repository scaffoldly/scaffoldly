import { Scms } from '../stores/scms';
import { event } from './events';
import { ApiHelper } from './apiHelper';
import { MessagesHelper } from './messagesHelper';
import { NOT_LOGGED_IN } from '../messages';

export class GithubHelper {
  scms: Scms;

  constructor(private apiHelper: ApiHelper, private messagesHelper: MessagesHelper) {
    this.scms = new Scms(this.apiHelper);
  }

  async promptLogin(withToken?: string): Promise<void> {
    event('fn:promptLogin');

    const accessToken = withToken || process.env.GITHUB_TOKEN;

    if (!accessToken) {
      throw new Error(NOT_LOGGED_IN(this.messagesHelper.processName));
    }

    const octokit = this.apiHelper.githubApi(accessToken);

    const { data: user } = await octokit.users.getAuthenticated();

    const location = this.scms.saveGithubToken(user.login, accessToken);
    console.log(`Saved GitHub credentials to ${location}`);
  }
}
