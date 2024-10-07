import { existsSync, readFileSync } from 'fs';
import { IScaffoldlyConfig, ProjectJson } from '..';
import { join } from 'path';
import { AbstractProject } from '.';
import { parse } from 'smol-toml';

type CargoToml = {
  package?: {
    name?: string;
    version?: string;
    edition?: string;
    metadata?: {
      scaffoldly?: Partial<IScaffoldlyConfig>;
    };
  };
  dependencies?: { [key: string]: string | { version?: string; features?: string[] } };
};

export class RustProject extends AbstractProject {
  private get rustProject(): Promise<{ cargoToml: CargoToml } | undefined> {
    return this.gitService.workDir.then((workDir) => {
      const cargoTomlPath = join(workDir, 'Cargo.toml');
      if (!existsSync(cargoTomlPath)) {
        return undefined;
      }

      const parsed = parse(readFileSync(cargoTomlPath, 'utf-8')) as CargoToml;

      return { cargoToml: parsed };
    });
  }

  get projectJson(): Promise<ProjectJson | undefined> {
    return Promise.all([this.rustProject]).then(([project]) => {
      const projectJson: ProjectJson = {};

      if (!project) {
        return undefined;
      }

      const { cargoToml } = project;
      projectJson.name = cargoToml.package?.name;
      projectJson.version = cargoToml.package?.version;

      projectJson.dependencies = Object.entries(cargoToml.dependencies || {}).reduce(
        (acc, [key, value]) => {
          if (typeof value === 'string') {
            acc[key] = value;
          } else if (typeof value === 'object' && typeof value.version === 'string') {
            acc[key] = value.version;
          }
          return acc;
        },
        {} as { [key: string]: string },
      );

      projectJson.scaffoldly = cargoToml.package?.metadata?.scaffoldly;

      return projectJson;
    });
  }
}
