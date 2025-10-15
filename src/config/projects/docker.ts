import { join, relative, sep } from 'path';
import { ProjectJson } from '..';
import { AbstractProject } from './abstract';
import { existsSync } from 'fs';

export class DockerProject extends AbstractProject {
  async setProject(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _name: string,
  ): Promise<void> {
    throw new Error('setProject is not supported for Dockerfile projects');
  }

  private get dockerfile(): Promise<string | undefined> {
    return this.workdir
      .then((workdir) => join(workdir, 'Dockerfile'))
      .then((dockerfile) => {
        if (!existsSync(dockerfile)) {
          return undefined;
        }
        return dockerfile;
      });
  }

  get projectJson(): Promise<ProjectJson | undefined> {
    return Promise.all([
      this.workdir,
      this.dockerfile,
      this.gitService?.origin,
      this.gitService?.sha,
    ]).then(([workdir, dockerfile, origin, sha]) => {
      if (!dockerfile) {
        return;
      }
      if (!origin) {
        return;
      }
      if (!sha) {
        return;
      }

      const runtime = `.${sep}${relative(workdir, dockerfile)}`;

      const projectJson: ProjectJson = { type: 'dockerfile' };
      projectJson.name = origin.path.replace('.', '-');
      projectJson.version = sha;
      projectJson.scaffoldly = {
        runtime,
        routes: null, // Disable automatic routes for Dockerfile projects
      };

      return projectJson;
    });
  }
}
