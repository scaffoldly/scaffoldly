import { NodeProject } from '../../config/projects/node';
import { DotnetProject } from '../../config/projects/dotnet';
import { GolangProject } from '../../config/projects/golang';
import { RustProject } from '../../config/projects/rust';
import { StandaloneProject } from '../../config/projects/standalone';
import { PythonProject } from '../../config/projects/python';
import { ProjectJson } from '..';
import { GitService } from '../../scaffoldly/commands/cd/git';

export class ProjectFactory {
  constructor(private gitService: GitService) {}

  get projectJson(): Promise<ProjectJson | undefined> {
    return Promise.all([
      new StandaloneProject(this.gitService).projectJson,
      new NodeProject(this.gitService).projectJson,
      new DotnetProject(this.gitService).projectJson,
      new GolangProject(this.gitService).projectJson,
      new RustProject(this.gitService).projectJson,
      new PythonProject(this.gitService).projectJson,
    ])
      .then(([standalone, node, dotnet, golang, rust, python]) => {
        const projectJson = node || dotnet || golang || rust || python;
        const name =
          standalone?.name ||
          node?.name ||
          dotnet?.name ||
          golang?.name ||
          rust?.name ||
          python?.name;

        if (standalone) {
          console.warn(`🟠 [${name}] Using \`scaffoldly.json\` for configuration.\n`);
          if (!standalone.name) {
            standalone.name = name;
          }
          return standalone;
        }

        if (projectJson) {
          return projectJson;
        }

        console.warn('🟠 App framework not detected. Using `scaffoldly.json` for configuration.\n');
        return standalone;
      })
      .then((projectJson) => {
        this.gitService.eventService.withProject(projectJson);
        return projectJson;
      });
  }
}
