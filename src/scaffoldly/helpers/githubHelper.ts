import { Scms } from '../stores/scms';
import { event } from './events';
import { ApiHelper } from './apiHelper';
import { MessagesHelper } from './messagesHelper';
import { NOT_LOGGED_IN } from '../messages';
import { GitService } from '../commands/cd/git';

export class GithubHelper {
  scms: Scms;

  constructor(
    private apiHelper: ApiHelper,
    private messagesHelper: MessagesHelper,
    private gitService: GitService,
  ) {
    this.scms = new Scms(this.apiHelper, this.messagesHelper, this.gitService);
  }

  async promptLogin(withToken?: string): Promise<void> {
    event('fn:promptLogin');

    const login = await this.scms.getLogin(withToken);

    if (!login) {
      throw new Error(NOT_LOGGED_IN(this.messagesHelper.processName));
    }
  }
}
