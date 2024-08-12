// eslint-disable-next-line import/named
import { simpleGit, SimpleGit } from 'simple-git';
import { DeployStatus } from '../aws';
import { ResourceOptions } from '..';

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
  git: SimpleGit;

  constructor(public readonly cwd: string = process.cwd()) {
    this.git = simpleGit({ baseDir: cwd });
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
          console.log('!!! remote', remote);
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
}
