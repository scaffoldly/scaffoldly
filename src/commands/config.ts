export type Entrypoint = 'develop' | 'build' | 'serve';

export type ScaffoldlyConfig = {
  name?: string;
  runtime?: string;
  handler?: string;
  route?: string;
  files?: string[];
  entrypoints?: { [key in Entrypoint]: string };
  // services?: {
  //   [key: string]: ScaffoldlyConfig;
  // };
};
