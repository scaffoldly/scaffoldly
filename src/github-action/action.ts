import { debug, getIDToken, exportVariable, notice, getInput, error, warning } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { deployedMarkdown, failedMarkdown } from './messages';
import { Status } from './status';
import { GitService } from '../scaffoldly/commands/cd/git';
import { DeployCommand } from '../scaffoldly/commands/deploy';
import path, { join } from 'path';
import { ApiHelper } from '../scaffoldly/helpers/apiHelper';
import { MessagesHelper } from '../scaffoldly/helpers/messagesHelper';
import { Scms } from '../scaffoldly/stores/scms';
import { tmpdir } from 'os';
import { writeFileSync } from 'fs';

const { GITHUB_RUN_ATTEMPT } = process.env;

export type Mode = 'pre' | 'main' | 'post';

export class Action {
  gitService: GitService;

  apiHelper: ApiHelper;

  messagesHelper: MessagesHelper;

  scms: Scms;

  _token?: string;

  _sha?: string;

  _branch?: string;

  constructor(private mode: Mode) {
    this.gitService = new GitService(this.cwd);
    this.apiHelper = new ApiHelper(process.argv);
    this.messagesHelper = new MessagesHelper(process.argv);
    this.scms = new Scms(this.apiHelper, this.messagesHelper, this.gitService);
  }

  async init(): Promise<Action> {
    debug('Initializing action...');
    this._token = await this.scms.getGithubToken(getInput('github-token'));
    this._branch = await this.gitService.branch;
    this._sha = await this.gitService.sha;

    return this;
  }

  async pre(status: Status): Promise<Status> {
    status.deployLogsUrl = await this.logsUrl;
    status.commitSha = this.commitSha;
    status.owner = this.owner;
    status.repo = this.repo;

    if (
      !(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) &&
      !process.env.AWS_ROLE_ARN
    ) {
      throw new Error(
        'AWS credentials are not set. Please ensure that AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (or AWS_ROLE_ARN) environment variables are set.',
      );
    }

    if (process.env.AWS_ROLE_ARN) {
      const idToken = await this.idToken;

      // Set up AWS environment variables
      process.env.AWS_WEB_IDENTITY_TOKEN_FILE = join(
        process.env.RUNNER_TEMP || tmpdir(),
        'id_token',
      );
      process.env.AWS_ROLE_SESSION_NAME = `scaffoldly-${context.runNumber}-${context.runId}`;

      // Save the ID token to a file
      writeFileSync(process.env.AWS_WEB_IDENTITY_TOKEN_FILE, idToken);

      // Export AWS environment variables
      exportVariable('AWS_WEB_IDENTITY_TOKEN_FILE', process.env.AWS_WEB_IDENTITY_TOKEN_FILE);
      exportVariable('AWS_ROLE_SESSION_NAME', process.env.AWS_ROLE_SESSION_NAME);
    }

    const region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
    const client = new STSClient({ region });

    try {
      const callerIdentity = await client.send(new GetCallerIdentityCommand({}));

      notice(`Deploying as ${callerIdentity.Arn} using ${callerIdentity.Arn}...`);
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }

      error(`Failed to get AWS Identity: ${e.message}`);
      debug(`Error: ${e}`);

      status.failed = true;
      status.shortMessage = e.message;
      status.longMessage = `Failed to get AWS Identity: ${e.message}.\n\nPlease ensure \`AWS_ACCESS_KEY_ID\` and \`AWS_SECRET_ACCESS_KEY\` (or \`AWS_ROLE_ARN\`) environment variables are set correctly.`;
    }

    return status;
  }

  async main(status: Status): Promise<Status> {
    debug(`status: ${JSON.stringify(status)}`);

    if (status.failed) {
      debug('status: ' + JSON.stringify(status));
      notice(`Deployment skipped due to failure...`);
      return status;
    }

    const deployCommand = new DeployCommand(this.gitService).withStatus(status).withOptions({
      notify: (message, level) => {
        if (level === 'error') {
          error(message);
        } else {
          notice(message);
        }
      },
    });

    switch (this.operation) {
      case 'deploy':
        try {
          await deployCommand.handle();
        } catch (e) {
          if (!(e instanceof Error)) {
            throw e;
          }

          status.failed = true;
          status.shortMessage = e.message;
          status.longMessage = 'TODO: Implement long message';
        }
        break;
      default:
        throw new Error(`Invalid operation: ${this.operation}`);
    }

    return status;
  }

  async post(status: Status): Promise<Status> {
    debug(`status: ${JSON.stringify(status)}`);

    if (!status.failed) {
      const { longMessage, shortMessage } = await deployedMarkdown(status);
      status.shortMessage = shortMessage;
      status.longMessage = longMessage;
    } else {
      const { longMessage, shortMessage } = await failedMarkdown(status, status.longMessage);
      status.shortMessage = shortMessage;
      status.longMessage = longMessage;
    }

    return status;
  }

  get logsUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      const { runId, job: jobName } = context;
      const logsUrl = `https://github.com/${this.owner}/${this.repo}/actions/runs/${runId}`;

      const octokit = getOctokit(this.token);

      octokit.rest.actions
        .listJobsForWorkflowRun({
          owner: this.owner,
          repo: this.repo,
          run_id: runId,
        })
        .then((jobs) => {
          const job = jobs.data.jobs.find(
            (j) => j.name === jobName && j.run_attempt === parseInt(GITHUB_RUN_ATTEMPT || '1', 10),
          );

          if (job && job.html_url) {
            resolve(job.html_url);
            return;
          }
        })
        .catch((e) => {
          if (!(e instanceof Error)) {
            reject(e);
            return;
          }
          warning(`Unable to infer logs URL: ${e.message}`);
          resolve(logsUrl);
        });
    });
  }

  get cwd(): string | undefined {
    const workingDirectory = getInput('working-directory') || undefined;
    let cwd = process.cwd();

    if (workingDirectory) {
      cwd = path.join(cwd, workingDirectory);
      try {
        process.chdir(cwd);
      } catch (e) {
        if (this.mode === 'main') {
          throw new Error(`Unable to change working directory to ${cwd}: ${e.message}`);
        }
      }
    }

    return cwd;
  }

  get operation(): 'deploy' | undefined {
    const operation = getInput('operation') as string | null;

    if (!operation) {
      return undefined;
    }

    if (!['deploy'].includes(operation)) {
      throw new Error(`Invalid operation: ${operation}. Expected 'deploy'.`);
    }

    return operation as 'deploy' | undefined;
  }

  get token(): string {
    if (!this._token) {
      throw new Error('Unable to determine github token. Was init() called?');
    }
    return this._token;
  }

  get idToken(): Promise<string> {
    return getIDToken('sts.amazonaws.com').then((idToken) => {
      if (!idToken) {
        throw new Error(
          'No ID Token found. Please ensure the `id-token: write` is enabled in the GitHub Action permissions.',
        );
      }
      return idToken;
    });
  }

  get commitSha(): string {
    if (!this._sha) {
      throw new Error('Unable to determine commit SHA. Was init() called?');
    }
    return this._sha.substring(0, 7);
  }

  get owner(): string {
    return context.repo.owner;
  }

  get repo(): string {
    return context.repo.repo;
  }
}
