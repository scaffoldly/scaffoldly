import { existsSync, readFileSync, writeFileSync } from 'fs';
import { IScaffoldlyConfig, ProjectJson } from '..';
import { join } from 'path';
import { AbstractProject } from './abstract';
import { parse, stringify } from 'smol-toml';

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
  async setProject(name: string): Promise<void> {
    return this.cargoTomlFile.then((cargoTomlFile) => {
      if (!cargoTomlFile) {
        return;
      }

      const cargoToml = parse(readFileSync(cargoTomlFile, 'utf-8')) as Partial<CargoToml>;

      if (!cargoToml.package) {
        return;
      }

      if (cargoToml.package) {
        cargoToml.package.name = name;
      }

      writeFileSync(cargoTomlFile, stringify(cargoToml));
    });
  }

  private get cargoTomlFile(): Promise<string | undefined> {
    return this.workdir
      .then((workDir) => join(workDir, 'Cargo.toml'))
      .then((cargoTomlFile) => {
        if (!existsSync(cargoTomlFile)) {
          return undefined;
        }
        return cargoTomlFile;
      });
  }

  private get rustProject(): Promise<{ cargoToml: CargoToml } | undefined> {
    return this.cargoTomlFile.then((cargoTomlFile) => {
      if (!cargoTomlFile) {
        return undefined;
      }

      const parsed = parse(readFileSync(cargoTomlFile, 'utf-8')) as CargoToml;

      return { cargoToml: parsed };
    });
  }

  get projectJson(): Promise<ProjectJson | undefined> {
    return Promise.all([this.rustProject]).then(([project]) => {
      const projectJson: ProjectJson = { type: 'rust' };

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
