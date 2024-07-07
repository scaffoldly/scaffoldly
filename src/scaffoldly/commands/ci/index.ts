import { DockerService } from './docker';
import { Command } from '../index';

export class CiCommand extends Command {
  dockerService: DockerService;

  constructor() {
    super();
    this.dockerService = new DockerService(this.cwd);
  }
}
