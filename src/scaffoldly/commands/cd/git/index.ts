// eslint-disable-next-line import/named
import { simpleGit, SimpleGit } from 'simple-git';
import { DeployStatus } from '../aws';
import { ResourceOptions } from '..';

export type GitDeployStatus = {
  envFiles?: string[];
};

const normalize = (branch: string | undefined) => branch?.replace('/', '-');

export class GitService {
  git: SimpleGit;

  constructor(cwd: string) {
    this.git = simpleGit({ baseDir: cwd });
  }

  public async predeploy(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _status: DeployStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: ResourceOptions,
  ): Promise<GitDeployStatus> {
    const gitDeployStatus: GitDeployStatus = {};

    const envFiles = await this.envFiles;
    gitDeployStatus.envFiles = envFiles;

    return gitDeployStatus;
  }

  get envFiles(): Promise<string[]> {
    const base = '.env';
    return Promise.all([this.branch.then(normalize), this.defaultBranch.then(normalize)])
      .then((files) => files.filter((f) => !!f) as string[])
      .then((files) => files.map((f) => `${base}.${f}`))
      .then((files) => [...new Set([...files, base])])
      .then((files) => {
        // TODO: do more?
        // TODO: pr-# file or .braches file?
        // TODO: tag-# file? or .tags file?
        return files;
      });
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
    return this.git.branch({}).then((b) => b?.current);
  }
}
