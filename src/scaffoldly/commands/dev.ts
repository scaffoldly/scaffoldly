import { GitService } from './cd/git';
import { CiCommand } from './ci';
import { FunctionUrlServer } from './ci/aws/lambda/function-url-server';
import { LambdaRuntimeServer } from './ci/aws/lambda/lambda-runtime-server';
import { CloudResource, ResourceOptions } from './cd';
import { onExit } from 'signal-exit';
import { DeployCommand } from './deploy';
import { DeployStatus } from './cd/aws';
import { ContainerPool } from './ci/docker/container-pool';
import { ServerStatus } from './ci/server/dev-server';

type DevStatus = DeployStatus & {
  lambdaRuntimeServer?: Partial<ServerStatus>;
  functionUrlServer?: Partial<ServerStatus>;
  containerPool?: Partial<ServerStatus>;
};

export class DevCommand extends CiCommand<DevCommand> {
  abortController = new AbortController();

  containerPool: ContainerPool;

  lambdaRuntimeServer: LambdaRuntimeServer;

  functionUrlServer: FunctionUrlServer;

  deployCommand: DeployCommand;

  status: DevStatus = {};

  options?: ResourceOptions;

  constructor(private gitService: GitService) {
    super(gitService);
    this.deployCommand = new DeployCommand(this.gitService);
    this.containerPool = new ContainerPool(
      this.abortController,
      gitService,
      this.dockerService,
      this.deployCommand.envService,
    );
    this.lambdaRuntimeServer = new LambdaRuntimeServer(this.containerPool);
    this.functionUrlServer = new FunctionUrlServer(this.lambdaRuntimeServer);

    this.registerShutdownHooks();
  }

  async handle(): Promise<void> {
    await this._handle(this.status, this.options);
  }

  private async _handle(status: DevStatus, options?: ResourceOptions): Promise<void> {
    options = options || this.options || {};
    options.dev = true;

    await this.configureContainerPool(status, options);
    await this.configureLambdaRuntimeServer(status, options);
    await this.configureFunctionUrlServer(status, options);

    this.deployCommand.withStatus(status).withOptions(options);
    await this.deployCommand.handle();

    if (!status.imageName) {
      throw new Error('Missing image name');
    }

    this.containerPool.imageName = status.imageName;

    await this.waitForShutdown();
  }

  async configureLambdaRuntimeServer(status: DevStatus, options: ResourceOptions): Promise<void> {
    const serverStatus = await new CloudResource<ServerStatus, ServerStatus>(
      {
        describe: () => ({
          type: 'Lambda Runtime Server',
        }),
        read: () => this.lambdaRuntimeServer.get(),
        create: () => this.lambdaRuntimeServer.create(),
        update: () => this.lambdaRuntimeServer.create(),
      },
      (resource) => resource,
    ).manage({ ...options, retries: 5 }, { lifecycle: 'started' });

    status.lambdaRuntimeServer = serverStatus;

    if (!status.lambdaRuntimeServer) {
      throw new Error('Lambda Runtime server is missing');
    }
  }

  async configureFunctionUrlServer(status: DevStatus, options: ResourceOptions): Promise<void> {
    const serverStatus = await new CloudResource<ServerStatus, ServerStatus>(
      {
        describe: () => ({
          type: 'Function URL Server',
        }),
        read: () => this.functionUrlServer.get(),
        create: () => this.functionUrlServer.create(),
        update: () => this.functionUrlServer.create(),
      },
      (resource) => resource,
    ).manage({ ...options, retries: 5 }, { lifecycle: 'started' });

    status.functionUrlServer = serverStatus;
    status.url = `http://localhost:${this.functionUrlServer.port}`;

    if (!status.functionUrlServer) {
      throw new Error('Function URL server is missing');
    }
  }

  async configureContainerPool(status: DevStatus, options: ResourceOptions): Promise<void> {
    const serverStatus = await new CloudResource<ServerStatus, ServerStatus>(
      {
        describe: () => ({
          type: 'Container Pool',
        }),
        read: () => this.containerPool.get(),
        create: () => this.containerPool.create(),
        update: () => this.containerPool.create(),
      },
      (resource) => resource,
    ).manage({ ...options, retries: 5 }, { lifecycle: 'started' });

    status.containerPool = serverStatus;

    if (!status.containerPool) {
      throw new Error('Container pool is missing');
    }
  }

  private async waitForShutdown(): Promise<void> {
    console.log("\nℹ️  Press 'Ctrl+C' to shutdown");

    await new Promise<void>((resolve) => {
      this.abortController.signal.addEventListener('abort', () => {
        resolve();
      });
    });
  }

  private registerShutdownHooks(): void {
    onExit(() => {
      console.log('Exiting!');
      this.abortController.abort();
    });

    process.on('uncaughtException', (err) => {
      console.error(`Received uncaught exception`, err);
      this.abortController.abort();
    });

    process.on('unhandledRejection', (reason) => {
      console.error(`Received unhandled rejection`, reason);
      this.abortController.abort();
    });
  }
}
