// eslint-disable-next-line import/named
import { simpleGit, SimpleGit } from 'simple-git';
import { DeployStatus } from '../aws';
import { ResourceOptions } from '..';

export type GitDeployStatus = {
  branch?: string;
  defaultBranch?: string;
};

export class GitService {
  git: SimpleGit;

  constructor(cwd: string) {
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
    return this.git.branch({}).then((b) => b?.current);
  }
}
