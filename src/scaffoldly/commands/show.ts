import { ApiHelper } from '../helpers/apiHelper';
import { Scms } from '../stores/scms';
import { AwsHelper } from '../helpers/awsHelper';
import { MessagesHelper } from '../helpers/messagesHelper';
import { GitService } from './cd/git';
import { DockerService } from './ci/docker';
import { Command } from '.';
import { ui } from '../command';
import { EnvService } from './ci/env';

export type ShowSubcommands = 'identity' | 'dockerfile';

export type OutputType = 'table' | 'json';

export type IdentityResponse = {
  github?: {
    identity: string;
  };
  aws?: {
    identity: string;
  };
};

export class ShowCommand extends Command<ShowCommand> {
  scms: Scms;

  awsHelper: AwsHelper;

  dockerService: DockerService;

  envService: EnvService;

  subcommand?: ShowSubcommands;

  constructor(
    private apiHelper: ApiHelper,
    private messagesHelper: MessagesHelper,
    private gitService: GitService,
  ) {
    super(process.cwd(), 'production'); // TODO withMode functionality
    this.scms = new Scms(this.apiHelper, this.messagesHelper, this.gitService);
    this.awsHelper = new AwsHelper(this.apiHelper);
    this.dockerService = new DockerService(this.gitService.cwd);
    this.envService = new EnvService(this.gitService);
  }

  withSubcommand(subcommand: ShowSubcommands): ShowCommand {
    this.subcommand = subcommand;
    return this;
  }

  async handle(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async _handle(withToken?: string): Promise<void> {
    switch (this.subcommand) {
      case 'identity': {
        return this.showIdentity(withToken);
      }
      case 'dockerfile': {
        return this.showDockerfile();
      }
      default:
        break;
    }

    throw new Error(`Unknown subcommand: ${this.subcommand}`);
  }

  public async fetchIdentity(withToken?: string): Promise<IdentityResponse> {
    const githubToken = await this.scms.getGithubToken(withToken);
    const identityResponse: IdentityResponse = {};

    if (githubToken) {
      identityResponse.github = {
        identity: await this.scms.getLogin(githubToken),
      };
    }

    const awsIdentity = await this.awsHelper.currentIdentity();
    if (awsIdentity) {
      identityResponse.aws = {
        identity: awsIdentity,
      };
    }

    return identityResponse;
  }

  private async showIdentity(withToken?: string): Promise<void> {
    const identity = await this.fetchIdentity(withToken);

    ui.updateBottomBar('');
    console.table(identity);
  }

  private async showDockerfile(): Promise<void> {
    ui.updateBottomBar('Generating Dockerfile...');
    const dockerfile = await this.dockerService.generateDockerfile(
      this.config,
      this.envService.buildEnv,
    );
    ui.updateBottomBar('');
    console.log(dockerfile);
  }
}
