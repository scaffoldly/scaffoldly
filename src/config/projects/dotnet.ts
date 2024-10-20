import { readdirSync, readFileSync } from 'fs';
import { IServiceConfig, ProjectJson, ProjectJsonBin, Script, Scripts } from '..';
import { join } from 'path';
import { AbstractProject } from '.';
import { parseStringPromise } from 'xml2js';

export type CsProj = {
  Project?: {
    PropertyGroup?: Array<{
      Version?: Array<string>;
      Scaffoldly?: Array<{
        Runtime?: Array<string>;
        Handler?: Array<string>;
        Bin?: Array<{
          $?: {
            name?: string; // e.g., "ApiApp.dll"
          };
          _: string; // Path to the DLL, e.g., "ApiApp:bin/Release/net8.0/ApiApp.dll"
        }>;
        Service?: Array<{
          $?: {
            name?: string; // e.g., "ApiApp"
          };
          File: Array<string>;
          Script?: Array<{
            $?: {
              name?: string; // e.g., "build", "start"
            };
            _: string; // Script command, e.g., "dotnet publish"
          }>;
        }>;
      }>;
    }>;
    ItemGroup?: Array<{
      PackageReference?: {
        $?: {
          Include?: string; // e.g., "Microsoft.AspNetCore.OpenApi"
          Version?: string; // e.g., "8.0.8"
        };
      }[];
    }>;
  };
};

export class DotnetProject extends AbstractProject {
  async setProject(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _name: string,
  ): Promise<void> {
    // This one is tricky:
    // - Rename .csproj file
    // - Rename .http file
    // - Replace "DotNetCSharpApp" in .csproj file
    throw new Error('Not implemented');
  }

  private get projectFile(): Promise<string | undefined> {
    return this.workdir.then((workDir) => {
      const files = readdirSync(workDir).filter((file) => file.endsWith('.csproj'));
      if (files.length === 0) {
        return undefined;
      }
      if (files.length > 1) {
        throw new Error(`Multiple .csproj files found: ${files.join(', ')}.`);
      }
      return files[0];
    });
  }

  private get project(): Promise<{ projectName: string; csProj: CsProj } | undefined> {
    return Promise.all([this.projectFile, this.workdir]).then(([projectFile, workDir]) => {
      if (!projectFile) {
        return undefined;
      }
      return (parseStringPromise(readFileSync(join(workDir, projectFile))) as Promise<CsProj>).then(
        (csProj) => {
          return { projectName: projectFile.replace('.csproj', ''), csProj };
        },
      );
    });
  }

  get projectJson(): Promise<ProjectJson | undefined> {
    return this.project.then((project) => {
      const projectJson: ProjectJson = {};

      if (!project) {
        return undefined;
      }

      const { projectName, csProj } = project;
      projectJson.name = projectName;

      const csProject = csProj?.Project;

      if (!csProject) {
        return undefined;
      }

      const propertyGroup = csProject.PropertyGroup?.[0];

      if (!propertyGroup) {
        return undefined;
      }

      const version = propertyGroup.Version?.[0];
      projectJson.version = version;

      const Scaffoldly = propertyGroup.Scaffoldly?.[0];

      if (!Scaffoldly) {
        return undefined;
      }

      const bin: ProjectJsonBin = (Scaffoldly.Bin || []).reduce((acc, binEntry) => {
        const name = binEntry.$?.name;
        const value = binEntry._;
        if (!name || !value) {
          return acc;
        }
        acc[name] = value;
        return acc;
      }, {} as ProjectJsonBin);

      const services: IServiceConfig[] = (Scaffoldly.Service || []).map((service) => {
        const scripts: Scripts = (service.Script || []).reduce((acc, script) => {
          const name = script.$?.name as Script;
          const value = script._;
          if (!name || !value) {
            return acc;
          }
          acc[name] = value;
          return acc;
        }, {} as Scripts);

        return {
          name: service.$?.name,
          scripts,
          files: service.File,
        } as IServiceConfig;
      });

      projectJson.scaffoldly = {
        runtime: Scaffoldly.Runtime?.[0],
        handler: Scaffoldly.Handler?.[0],
        bin,
        services,
      };

      return projectJson;
    });
  }
}
