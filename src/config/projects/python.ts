import { existsSync, readFileSync, writeFileSync } from 'fs';
import { IScaffoldlyConfig, IServiceConfig, ProjectJson } from '..';
import { join } from 'path';
import { AbstractProject } from '.';
import { parse, stringify } from 'smol-toml';

type ScaffoldlyConfigWithServiceMap = IScaffoldlyConfig & {
  services?: Array<Partial<IServiceConfig>[]> | { [key: string]: Partial<IServiceConfig> };
};

type PyprojectToml = {
  tool?: {
    poetry?: {
      name?: string;
      version?: string;
      dependencies?: { [key: string]: string | { version?: string; extras?: string[] } };
    };
    scaffoldly?: Partial<ScaffoldlyConfigWithServiceMap>;
  };
  'build-system'?: {
    requires?: string[];
  };
};

export class PythonProject extends AbstractProject {
  async setProject(name: string): Promise<void> {
    return this.pyProjectFile.then((pyProjectFile) => {
      if (!pyProjectFile) {
        return;
      }

      const pyProject = parse(readFileSync(pyProjectFile, 'utf-8')) as Partial<PyprojectToml>;

      if (pyProject.tool?.poetry) {
        pyProject.tool.poetry.name = name;
      }

      writeFileSync(pyProjectFile, stringify(pyProject));
    });
  }

  private get pyProjectFile(): Promise<string | undefined> {
    return this.workdir
      .then((workDir) => join(workDir, 'pyproject.toml'))
      .then((pyProjectFile) => {
        if (!existsSync(pyProjectFile)) {
          return undefined;
        }
        return pyProjectFile;
      });
  }

  private get pyProject(): Promise<{ pyprojectToml: PyprojectToml } | undefined> {
    return this.pyProjectFile.then((pyProjectFile) => {
      if (!pyProjectFile) {
        return undefined;
      }

      const parsed = parse(readFileSync(pyProjectFile, 'utf-8')) as PyprojectToml;

      return { pyprojectToml: parsed };
    });
  }

  get projectJson(): Promise<ProjectJson | undefined> {
    return Promise.all([this.pyProject]).then(([project]) => {
      const projectJson: ProjectJson = {};

      if (!project) {
        return undefined;
      }

      const { pyprojectToml } = project;

      const dependencies = pyprojectToml.tool?.poetry?.dependencies || {};

      if (pyprojectToml.tool?.poetry) {
        projectJson.name = pyprojectToml.tool.poetry.name;
        projectJson.version = pyprojectToml.tool.poetry.version;
      }

      projectJson.dependencies = Object.entries(dependencies || {}).reduce((acc, [key, value]) => {
        if (typeof value === 'string') {
          acc[key] = value;
        } else if (typeof value === 'object' && typeof value.version === 'string') {
          acc[key] = value.version;
        }
        return acc;
      }, {} as { [key: string]: string });

      const services =
        pyprojectToml.tool?.scaffoldly?.services &&
        Array.isArray(pyprojectToml.tool?.scaffoldly?.services)
          ? pyprojectToml.tool.scaffoldly.services
          : Object.entries(pyprojectToml.tool?.scaffoldly?.services || {}).map(([key, value]) => ({
              ...value,
              name: key,
            }));

      const scaffoldly: Partial<IScaffoldlyConfig> = {
        ...pyprojectToml.tool?.scaffoldly,
        packages: [
          ...(pyprojectToml.tool?.scaffoldly?.packages || []),
          ...(pyprojectToml['build-system']?.requires || []).map((pkg) => `pip:${pkg}`),
        ],
        services,
      };

      projectJson.scaffoldly = scaffoldly;

      return projectJson;
    });
  }
}
