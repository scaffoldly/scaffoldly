import { DockerService } from './docker';
import { Command } from '../index';
import { GitService } from '../cd/git';

export class CiCommand extends Command {
  dockerService: DockerService;

  constructor(gitService: GitService) {
    super(gitService.cwd);
    this.dockerService = new DockerService(this.cwd);
  }
}
