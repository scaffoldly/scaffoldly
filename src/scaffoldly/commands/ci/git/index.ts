// eslint-disable-next-line import/named
import { simpleGit, SimpleGit } from 'simple-git';

export class GitService {
  git: SimpleGit;

  constructor(cwd: string) {
    this.git = simpleGit({ baseDir: cwd });
  }

  get branch(): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve) => {
      this.git.branch({}, (err, branchSummary) => {
        if (err) {
          resolve(undefined);
        }

        resolve(branchSummary.current);
      });
    });
  }
}
