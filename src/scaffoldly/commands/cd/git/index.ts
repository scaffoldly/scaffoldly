// eslint-disable-next-line import/named
import { simpleGit, SimpleGit } from 'simple-git';
import { ResourceOptions } from '..';
import { context } from '@actions/github';
import semver from 'semver';
import { ScaffoldlyConfig } from '../../../../config';

export type GitDeployStatus = {
  branch?: string;
  defaultBranch?: string;
  alias?: string;
  remote?: string;
};

export type Origin = {
  host: string;
  path: string;
  protocol: 'git' | 'https';
  origin: string;
};

export class GitService {
  _git?: SimpleGit;

  _cwd?: string;

  constructor(cwd?: string, private config?: ScaffoldlyConfig) {
    this._cwd = cwd;
    if (cwd) {
      this._git = simpleGit({ baseDir: cwd });
    }
  }

  withConfig(config: ScaffoldlyConfig): GitService {
    return new GitService(this._cwd, config);
  }

  get git(): SimpleGit {
    if (!this._git) {
      throw new Error('Unable to determine git instance. Was the current working directory set?');
    }
    return this._git;
  }

  get cwd(): string {
    if (!this._cwd) {
      throw new Error('Unable to determine current working directory');
    }
    return this._cwd;
  }

  public async predeploy(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    status: GitDeployStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: ResourceOptions,
  ): Promise<void> {
    status.branch = await this.branch;
    status.defaultBranch = await this.defaultBranch;
    status.remote = await this.remote;

    if (status.branch === 'tagged') {
      status.alias = this.tag;
    } else {
      status.alias = status.branch;
    }
  }

  get defaultBranch(): Promise<string | undefined> {
    return this.git
      .getRemotes(true)
      .then((remotes) => {
        return remotes.find((r) => r.name === 'origin');
      })
      .then((remote) =>
        this.git.remote(['show', remote?.name || 'origin']).then((show) => {
          if (!show) {
            return undefined;
          }
          const details = show.match(/HEAD branch: (.+)/);
          if (!details || details.length < 2) {
            return undefined;
          }
          return details[1].trim();
        }),
      );
  }

  get branch(): Promise<'tagged' | string | undefined> {
    if (context.ref) {
      if (context.ref.startsWith('refs/heads/')) {
        return Promise.resolve(context.ref.replace('refs/heads/', ''));
      } else if (context.ref.startsWith('refs/tags/')) {
        return Promise.resolve('tagged');
      } else {
        throw new Error(`Unsupported ref format: ${context.ref}`);
      }
    }
    return this.git.branch({}).then((b) => b?.current);
  }

  get origin(): Promise<Origin | undefined> {
    return this.remote.then((remote) => {
      if (!remote) {
        return undefined;
      }

      const protocol = remote.startsWith('git@') ? 'git' : 'https';

      try {
        const url = new URL(protocol === 'git' ? remote.split('@')[1] : remote);
        const host = protocol === 'git' ? url.protocol.split(':')[0] : url.host;
        const path = (protocol === 'git' ? url.pathname : url.pathname.slice(1)).replace(
          '.git',
          '',
        );
        return { host, path, protocol, origin: remote };
      } catch (e) {
        throw new Error(`Unable to parse orgin from remote: ${remote}`);
      }
    });
  }

  get remote(): Promise<string | undefined> {
    return this.git
      .getRemotes(true)
      .then((remotes) => {
        return remotes.find((r) => r.name === 'origin');
      })
      .then((remote) => remote?.refs.fetch);
  }

  get sha(): Promise<string> {
    if (context.eventName === 'pull_request') {
      const pullRequest = context.payload.pull_request;
      if (!pullRequest || !pullRequest.head || !pullRequest.head.sha) {
        throw new Error('Unable to determine PR commit SHA');
      }
      return Promise.resolve(pullRequest.head.sha.substring(0, 7));
    }
    if (context.sha) {
      return Promise.resolve(context.sha.substring(0, 7));
    }
    return this.git.revparse(['HEAD']);
  }

  get tag(): string {
    if (!context.ref) {
      // TODO Support deploying from a tag locally
      throw new Error(
        'Unable to determine tag. Make sure this operation is running in GitHub Actions',
      );
    }

    let tag: string | undefined = undefined;
    if (context.ref && context.ref.startsWith('refs/tags/')) {
      tag = context.ref.replace('refs/tags/', '');
    }

    const parsed = semver.parse(this.config?.version) || semver.parse(tag);

    if (parsed) {
      tag = `v${parsed.major}`;
    }

    if (tag) {
      return tag;
    }

    throw new Error(`Unable to parse version or tag (${JSON.stringify(parsed)})`);
  }
}
