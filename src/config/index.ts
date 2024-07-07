import { base58 } from '@scure/base';
import { PackageJsonBin } from '../scaffoldly/commands/index';
import packageJson from '../../package.json';

export type Script = 'develop' | 'build' | 'start';

export type ScaffoldlyConfig = {
  name: string;
  version: string;
  runtime?: string;
  handler?: string;
  files?: string[]; // Get copied to workdir/{file} during build and serve
  devFiles?: string[]; // Get copied to workdir/{file} during dev
  bin?: PackageJsonBin; // Get copied to workdir root
  scripts?: { [key in Script]: string };
  // services?: {
  //   [key: string]: ScaffoldlyConfig;
  // };
};

export const encode = (config: ScaffoldlyConfig): string => {
  return `${packageJson.name}@${packageJson.version}:${base58.encode(
    new TextEncoder().encode(JSON.stringify(config)),
  )}`;
};

export const decode = (config: string): ScaffoldlyConfig => {
  if (config.startsWith(`${packageJson.name}@${packageJson.version}:`)) {
    return JSON.parse(
      new TextDecoder().decode(
        base58.decode(config.split(`${packageJson.name}@${packageJson.version}:`)[1]),
      ),
    );
  }
  throw new Error(`Invalid config: ${config}`);
};
