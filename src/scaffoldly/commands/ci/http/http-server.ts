import express, { Express } from 'express';
import { Server } from 'http';
import { DevServer } from '../server/dev-server';

export type HttpServerOptions = {
  timeout: number;
};

export abstract class HttpServer extends DevServer {
  protected readonly app: Express;

  protected server?: Server;

  constructor(
    name: string,
    public readonly port: number,
    abortController: AbortController,
    protected readonly options: HttpServerOptions = {
      timeout: 30,
    },
  ) {
    super(name, abortController);
    this.app = express();
  }

  abstract registerHandlers(): Promise<void>;

  start(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        return resolve();
      }

      this.registerHandlers().then(() => {
        this.server = this.app.listen(this.port, '::', () => {
          resolve();
        });
        this.server.setTimeout(this.options.timeout * 1000);
        this.server.on('close', () => {
          this.abortController.abort();
        });
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    if (this.server) {
      this.server.close();
      this.server = undefined;
    }
  }
}
