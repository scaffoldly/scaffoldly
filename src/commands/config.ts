import { PackageJsonBin } from './ci';

export type Entrypoint = 'develop' | 'build' | 'start';

export type ScaffoldlyConfig = {
  name?: string;
  runtime?: string;
  handler?: string;
  route?: string;
  files?: string[]; // Get copied to workdir/{file} during build and serve
  bin?: PackageJsonBin; // Get copied to workdir root
  devFiles?: string[]; // Get copied to workdir/{file} during build
  entrypoints?: { [key in Entrypoint]: string };
  // services?: {
  //   [key: string]: ScaffoldlyConfig;
  // };
};
