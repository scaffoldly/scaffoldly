import { event } from '../helpers/events';
import { ApiHelper } from '../helpers/apiHelper';
import { Scms } from '../stores/scms';
import { AwsHelper } from '../helpers/awsHelper';
import { MessagesHelper } from '../helpers/messagesHelper';
import { GitService } from './cd/git';
import { DockerService } from './ci/docker';
import { Command } from '.';
import { ui } from '../command';
import { EnvService } from './cd/env';

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

export class ShowCommand extends Command {
  gitService: GitService;

  scms: Scms;

  awsHelper: AwsHelper;

  dockerService: DockerService;

  envService: EnvService;

  constructor(
    private apiHelper: ApiHelper,
    private messagesHelper: MessagesHelper,
    gitService: GitService,
  ) {
    super(gitService.cwd);
    this.gitService = new GitService(process.cwd());
    this.scms = new Scms(this.apiHelper, this.messagesHelper, this.gitService);
    this.awsHelper = new AwsHelper(this.apiHelper);
    this.dockerService = new DockerService(this.cwd);
    this.envService = new EnvService(this.cwd, this.config);
  }

  public async handle(subcommand: ShowSubcommands, withToken?: string): Promise<void> {
    switch (subcommand) {
      case 'identity': {
        event('show', subcommand);
        return this.showIdentity(withToken);
      }
      case 'dockerfile': {
        event('show', subcommand);
        return this.showDockerfile();
      }
      default:
        break;
    }

    throw new Error(`Unknown subcommand: ${subcommand}`);
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
      'build',
      this.envService.buildEnv,
    );
    ui.updateBottomBar('');
    console.log(dockerfile);
  }
}
