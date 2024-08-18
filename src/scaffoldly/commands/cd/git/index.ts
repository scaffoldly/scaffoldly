// eslint-disable-next-line import/named
import { simpleGit, SimpleGit } from 'simple-git';
import { DeployStatus } from '../aws';
import { ResourceOptions } from '..';
import { context } from '@actions/github';

export type GitDeployStatus = {
  branch?: string;
  defaultBranch?: string;
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

  constructor(cwd?: string) {
    this._cwd = cwd;
    if (cwd) {
      this._git = simpleGit({ baseDir: cwd });
    }
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
    status: DeployStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: ResourceOptions,
  ): Promise<DeployStatus> {
    const gitDeployStatus: GitDeployStatus = {};

    gitDeployStatus.branch = await this.branch;
    gitDeployStatus.defaultBranch = await this.defaultBranch;
    gitDeployStatus.remote = await this.remote;

    return { ...status, ...gitDeployStatus };
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

  get branch(): Promise<string | undefined> {
    return this.ref.then((ref) => {
      if (ref) {
        return ref;
      }
      return this.git.branch({}).then((b) => b?.current);
    });
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

  get owner(): Promise<string> {
    if (process.env.GITHUB_REPOSITORY_OWNER) {
      return Promise.resolve(process.env.GITHUB_REPOSITORY_OWNER);
    }

    return this.origin.then((origin) => {
      const [owner] = origin?.path.split('/') || [];
      if (!owner) {
        throw new Error('Unable to determine owner from origin');
      }
      return owner;
    });
  }

  get repo(): Promise<string> {
    if (process.env.GITHUB_REPOSITORY) {
      return Promise.resolve(process.env.GITHUB_REPOSITORY.split('/')[1]);
    }
    return this.origin.then((origin) => {
      const [, repo] = origin?.path.split('/') || [];
      if (!repo) {
        throw new Error('Unable to determine repo from origin');
      }
      return repo;
    });
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

  get ref(): Promise<string | undefined> {
    if (!process.env.GITHUB_REF) {
      return this.branch;
    }

    const { GITHUB_REF, GITHUB_HEAD_REF } = process.env;

    if (GITHUB_REF.endsWith('/merge')) {
      if (!GITHUB_HEAD_REF) {
        throw new Error('Unable to determine branch from GITHUB_HEAD_REF');
      }
      return Promise.resolve(GITHUB_HEAD_REF.replace('refs/heads/', ''));
    }

    if (GITHUB_REF.startsWith('refs/tags/')) {
      throw new Error('Not Implemented: tags');
    }

    if (GITHUB_REF.startsWith('refs/heads/')) {
      return Promise.resolve(GITHUB_REF.replace('refs/heads/', ''));
    }

    throw new Error('Unable to determine branch from GITHUB_REF');
  }

  get stage(): Promise<string> {
    return this.branch.then((branch) => {
      if (!branch) {
        throw new Error('Unable to determine branch from GITHUB_REF');
      }

      let deploymentStage = branch.replaceAll('/', '-').replaceAll('_', '-');

      if (this.prNumber) {
        const { GITHUB_BASE_REF } = process.env;
        if (!GITHUB_BASE_REF) {
          throw new Error('Unable to determine base ref from GITHUB_BASE_REF');
        }

        const normalizedBaseRef = GITHUB_BASE_REF.replaceAll('/', '-').replaceAll('_', '-');
        deploymentStage = `${normalizedBaseRef}-pr-${this.prNumber}`;
      }

      return deploymentStage;
    });
  }

  get prNumber(): number | undefined {
    if (context.eventName === 'pull_request') {
      if (!context.payload.pull_request || !context.payload.pull_request.number) {
        throw new Error('Unable to determine PR number');
      }
      return context.payload.pull_request?.number;
    }
    return undefined;
  }
}
