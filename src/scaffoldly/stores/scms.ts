import { Octokit } from 'octokit';
import { homedir, platform } from 'os';
import { join } from 'path';
import fs from 'fs';
import { NOT_LOGGED_IN } from '../messages';
import { ApiHelper } from '../helpers/apiHelper';
import { MessagesHelper } from '../helpers/messagesHelper';
import { parse } from 'yaml';
import { GitService, Origin } from '../commands/cd/git';

export type Scm = 'github';

export type ScmClients = {
  github?: Octokit;
};

export class NoTokenError extends Error {
  constructor(message?: string) {
    super(message || 'No token!');
  }
}

type GhHostsFile = {
  [host: string]: { oauth_token?: string; user?: string; git_protocol?: string };
};

export class Scms {
  constructor(
    private apiHelper: ApiHelper,
    private messagesHelper: MessagesHelper,
    private gitService: GitService,
  ) {}

  private getTokenFromEnv(): string | undefined {
    return process.env.GITHUB_TOKEN;
  }

  private getTokenFromGhCli(origin: Origin): string | undefined {
    const searchPaths = [join(homedir(), join('.config', 'gh', 'hosts.yml'))];
    if (platform() === 'win32' && process.env.APPDATA) {
      searchPaths.push(join(process.env.APPDATA, 'GitHub CLI', 'hosts.yml'));
    }

    const hostsPath = searchPaths.find((p) => fs.existsSync(p));
    if (!hostsPath) {
      return;
    }

    try {
      const content = fs.readFileSync(hostsPath).toString();
      const data = parse(content) as GhHostsFile;

      const hostData = data[origin.host];
      if (!hostData) {
        return;
      }

      return hostData.oauth_token;
    } catch (e) {
      if (e instanceof Error) {
        return;
      }
    }

    return undefined;
  }

  public async getGithubToken(withToken?: string): Promise<string | undefined> {
    if (withToken) {
      return withToken;
    }

    let token = this.getTokenFromEnv();
    if (token) {
      return token;
    }

    const origin = await this.gitService.origin;
    if (!origin) {
      throw new NoTokenError('Unable to determine origin');
    }

    token = this.getTokenFromGhCli(origin);

    if (token) {
      return token;
    }

    throw new Error("Couldn't find a GitHub token");
  }

  private async getOctokit(token: string): Promise<Octokit | undefined> {
    return this.apiHelper.githubApi(token);
  }

  public async getLogin(withToken?: string): Promise<string> {
    const token = await this.getGithubToken(withToken);

    if (!token) {
      throw new NoTokenError('Unable to find a GitHub Token');
    }

    const octokit = await this.getOctokit(token);

    if (!octokit) {
      throw new NoTokenError('Unable to create Octokit instance');
    }

    try {
      const { data: user } = await octokit.rest.users.getAuthenticated();
      return user.login;
    } catch (e) {
      // No-op
    }

    try {
      const { data: repos } = await octokit.rest.apps.listReposAccessibleToInstallation();
      if (repos.total_count === 1) {
        return repos.repositories[0].full_name;
      }
    } catch (e) {
      // No-op
    }

    throw new Error(NOT_LOGGED_IN(this.messagesHelper.processName));
  }
}
