import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ProjectJson } from '..';
import { join } from 'path';
import { AbstractProject } from '.';

type GoMod = {
  module?: string;
  require?: { module: string; version: string }[];
  // todo support replace directives
};

export class GolangProject extends AbstractProject {
  async setProject(name: string): Promise<void> {
    this.goModFile.then((goModFile) => {
      // Find the first line that starts with "module"
      // Replace the module name with the new name
      // Write the file back to disk
      if (!goModFile) {
        return;
      }

      const lines = readFileSync(goModFile, 'utf8').split('\n');
      const newLines = lines.map((line) => {
        const moduleMatch = line.match(/^module\s+(\S+)/);
        if (moduleMatch) {
          return `module ${name}`;
        }
        return line;
      });
      writeFileSync(goModFile, newLines.join('\n'));
    });
  }

  private get goModFile(): Promise<string | undefined> {
    return this.workdir
      .then((workDir) => join(workDir, 'go.mod'))
      .then((goModFile) => {
        if (!existsSync(goModFile)) {
          return undefined;
        }
        return goModFile;
      });
  }

  private get goProject(): Promise<{ projectName?: string; goMod: GoMod } | undefined> {
    return this.goModFile.then((goModFile) => {
      if (!goModFile) {
        return undefined;
      }
      // THIS IS AWFUL I WISH I HAD A BETTER WAY TO DO THIS I FEEL DIRTY
      // - All I really want is module and dependencies
      // - Perhaps look into golang tooling and make a JS variant of the go mod parser
      // - TODO: release a go mod parser library
      const lines = readFileSync(goModFile, 'utf8').split('\n');

      let projectName: string | undefined = undefined;
      let insideRequireBlock = false;

      const parsed: GoMod = {};

      lines.forEach((line) => {
        const moduleMatch = line.match(/^module\s+(\S+)/);
        const requireMatch = line.match(/^require\s+(\S+)\s+(\S+)/); // Single-line require
        const requireStartMatch = line.match(/^require\s*\(\s*$/); // Start of multiline require
        const requireEndMatch = line.match(/^\s*\)\s*$/); // End of multiline require

        if (moduleMatch) {
          parsed.module = moduleMatch[1];
          const projectNameMatch = line.match(/(?:^module\s+|\/)([^/\s]+)$/);
          if (projectNameMatch) {
            projectName = projectNameMatch[1];
          }
        } else if (requireStartMatch) {
          insideRequireBlock = true; // We're inside a multi-line require block
        } else if (requireEndMatch) {
          insideRequireBlock = false; // End of the multi-line require block
        } else if (insideRequireBlock) {
          const multilineRequireMatch = line.match(/^\s*(\S+)\s+(\S+)\s(.*)$/); // Require entries within multiline block
          if (multilineRequireMatch) {
            if (!parsed.require) {
              parsed.require = [];
            }
            parsed.require.push({
              module: multilineRequireMatch[1],
              version: multilineRequireMatch[2],
            });
          }
        } else if (requireMatch) {
          if (!parsed.require) {
            parsed.require = [];
          }
          parsed.require.push({
            module: requireMatch[1],
            version: requireMatch[2],
          });
        }
      });

      return { projectName, goMod: parsed };
    });
  }

  get projectJson(): Promise<ProjectJson | undefined> {
    return Promise.all([this.goProject, this.standaloneConfig]).then(([project, config]) => {
      const projectJson: ProjectJson = {
        type: 'golang',
      };

      if (!project) {
        return undefined;
      }

      const { projectName, goMod } = project;
      projectJson.name = projectName;

      // TODO: support version from golang tagging structures
      // TODO: support replace directives
      projectJson.dependencies = goMod.require?.reduce((acc, dep) => {
        acc[dep.module] = dep.version;
        return acc;
      }, {} as { [key: string]: string });

      if (config) {
        projectJson.scaffoldly = config;
      }

      return projectJson;
    });
  }
}
