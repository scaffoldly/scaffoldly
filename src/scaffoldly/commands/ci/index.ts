import { DockerService } from './docker';
import { Command } from '../index';
import { GitService } from '../cd/git';
import { Mode } from '../../../config';

export abstract class CiCommand<T> extends Command<T> {
  dockerService: DockerService;

  constructor(gitService: GitService, mode: Mode) {
    super(gitService, mode);
    this.dockerService = new DockerService(gitService);
  }
}
