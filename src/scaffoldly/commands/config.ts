import { PackageJsonBin } from './ci';

export type Script = 'develop' | 'build' | 'start';

export type ScaffoldlyConfig = {
  name?: string;
  runtime?: string;
  handler?: string;
  route?: string;
  files?: string[]; // Get copied to workdir/{file} during build and serve
  devFiles?: string[]; // Get copied to workdir/{file} during dev
  bin?: PackageJsonBin; // Get copied to workdir root
  scripts?: { [key in Script]: string };
  // services?: {
  //   [key: string]: ScaffoldlyConfig;
  // };
};
