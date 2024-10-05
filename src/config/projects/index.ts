import { ProjectJson } from '..';
import { GitService } from '../../scaffoldly/commands/cd/git';

export abstract class AbstractProject {
  constructor(protected gitService: GitService) {}

  abstract get projectJson(): Promise<ProjectJson | undefined>;
}
