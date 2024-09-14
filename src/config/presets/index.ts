import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ScaffoldlyConfig } from '..';

export abstract class Preset {
  constructor(protected cwd: string) {}

  abstract get config(): Promise<ScaffoldlyConfig>;
  abstract get configPath(): string;

  async save(): Promise<void> {
    const configPath = this.configPath;
    if (!existsSync(configPath)) {
      throw new Error(`File not found at ${configPath}`);
    }

    if (configPath.endsWith('.json')) {
      return this.modifyJsonConfig(configPath);
    }

    throw new Error(`Unsupported file type for ${configPath}`);
  }

  private async modifyJsonConfig(filePath: string): Promise<void> {
    const content = await JSON.parse(readFileSync(filePath, 'utf8'));
    const config = await this.config;
    const scaffoldlyConfig = config.scaffoldly;
    const newContent = { scaffoldly: config.scaffoldly };

    writeFileSync(filePath, JSON.stringify({ ...content, ...newContent }, null, 2));

    console.log(
      `Updated ${filePath} with scaffoldly configuration:\n\n${JSON.stringify(
        scaffoldlyConfig,
        null,
        2,
      )}\n`,
    );

    console.log('You may now omit `--preset` when running `scaffoldly` commands.');
  }
}
