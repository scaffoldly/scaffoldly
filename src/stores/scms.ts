import { Octokit } from '@octokit/rest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { ERROR_LOADING_FILE, NOT_LOGGED_IN } from '../messages';
import { ui } from '../command';
import { ApiHelper } from '../helpers/apiHelper';
import { MessagesHelper } from '../helpers/messagesHelper';

export const CONFIG_DIR = `${path.join(os.homedir(), '.scaffoldly')}`;

export type Scm = 'github';

type GithubFile = {
  login: string;
  token: string;
};

export type ScmClients = {
  github?: Octokit;
};

export class NoTokenError extends Error {
  constructor() {
    super('No token!');
  }
}

export class Scms {
  githubFile: string;

  constructor(
    private apiHelper: ApiHelper,
    private messagesHelper: MessagesHelper,
    configDir = CONFIG_DIR,
  ) {
    this.githubFile = path.join(configDir, 'github-token.json');

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, {
        mode: 0o700,
      });
    }
  }

  async loadClients(): Promise<ScmClients> {
    const clients: ScmClients = {};
    clients.github = this.getOctokit();
    return clients;
  }

  public saveGithubToken(login: string, token?: string): string {
    fs.writeFileSync(this.githubFile, JSON.stringify({ login, token } as GithubFile), {
      mode: 0o600,
    });
    ui.updateBottomBar('');
    console.log(`Token cached in: ${this.githubFile}`);
    return this.githubFile;
  }

  public getGithubToken(withToken?: string): string | undefined {
    const githubFileExists = fs.existsSync(this.githubFile);

    if (!githubFileExists) {
      throw new NoTokenError();
    }

    try {
      const { token } = JSON.parse(fs.readFileSync(this.githubFile).toString()) as GithubFile;
      return token;
    } catch (e) {
      if (withToken) {
        return withToken;
      }
      if (e instanceof Error) {
        ui.updateBottomBar('');
        console.warn(ERROR_LOADING_FILE(this.githubFile, e));
        return;
      }
      throw e;
    }
  }

  private getOctokit(): Octokit | undefined {
    const token = this.getGithubToken();
    if (!token) {
      return;
    }
    return this.apiHelper.githubApi(token);
  }

  public async getLogin(withToken?: string): Promise<string> {
    const token = withToken || this.getGithubToken(withToken);
    if (!token) {
      throw new Error('Unable to get token');
    }

    const octokit = new Octokit({ auth: token });

    ui.updateBottomBar('Fetching GitHub identity...');

    try {
      const { data: user } = await octokit.users.getAuthenticated();
      return user.login;
    } catch (e) {}

    try {
      const { data: repos } = await octokit.apps.listReposAccessibleToInstallation();
      if (repos.total_count === 1) {
        return repos.repositories[0].full_name;
      }
    } catch (e) {}

    throw new Error(NOT_LOGGED_IN(this.messagesHelper.processName));
  }
}
