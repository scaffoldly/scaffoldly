import { DockerService } from './docker';
import { Command } from '../index';
import { GitService } from '../cd/git';

export abstract class CiCommand<T> extends Command<T> {
  dockerService: DockerService;

  constructor(gitService: GitService) {
    super(gitService.cwd);
    this.dockerService = new DockerService(this.cwd);
  }
}
