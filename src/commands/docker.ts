import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import Docker from 'dockerode';
import path from 'path';

export type Service = {
  container_name?: string;
  image?: string;
  build?: {
    context?: string;
    dockerfile?: string;
  };
  environment?: {
    [key: string]: string;
  };
  env_file?: string[];
  volumes?: string[];
  ports?: string[];
};

export interface DockerComposeJson {
  version: string;

  services?: {
    [key: string]: Service;
  };
}

export class DockerCompose {
  docker: Docker;
  dockerCompose: DockerComposeJson;

  constructor(path: string) {
    this.docker = new Docker();

    this.dockerCompose = load(readFileSync(path, 'utf8')) as DockerComposeJson;
  }

  get cwd(): string {
    return process.cwd();
  }

  get serviceNames(): string[] {
    return Object.keys(this.dockerCompose.services || {});
  }

  get services(): Service[] {
    return Object.entries(this.dockerCompose.services || {}).map(([name, service]) => {
      return {
        ...service,
        container_name: name,
      };
    });
  }

  async build(name: string) {
    const service = this.services.find((service) => service.container_name === name);
    if (!service) {
      return;
    }

    const { build } = service;
    if (!build) {
      return;
    }

    const { context, dockerfile } = build;
    if (!context || !dockerfile) {
      return;
    }

    const stream = await this.docker.buildImage(
      { context: path.join(this.cwd, context), src: [path.join(this.cwd, dockerfile)] },
      { t: service.container_name },
    );

    const foo = await new Promise<any[]>((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (err, res) => (err ? reject(err) : resolve(res)),
        (event) => {
          console.log(`!!! [${name}] event`, JSON.stringify(event, null, 2));
        },
      );
    });

    console.log(`Built ${name}: ${JSON.stringify(foo, null, 2)}`);
  }
}
