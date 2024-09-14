import { debug, getIDToken, exportVariable, notice, getInput, error, warning } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import {
  STSClient,
  AssumeRoleWithWebIdentityCommand,
  GetCallerIdentityCommand,
} from '@aws-sdk/client-sts';
import { deployedMarkdown, failedMarkdown, roleSetupMoreInfo } from './messages';
import { Status } from './status';
import { GitService } from '../scaffoldly/commands/cd/git';
import { DeployCommand } from '../scaffoldly/commands/deploy';
import path from 'path';
import { ApiHelper } from '../scaffoldly/helpers/apiHelper';
import { MessagesHelper } from '../scaffoldly/helpers/messagesHelper';
import { Scms } from '../scaffoldly/stores/scms';

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

    const region =
      getInput('aws-region') ||
      process.env.AWS_DEFAULT_REGION ||
      process.env.AWS_REGION ||
      'us-east-1';
    const role = getInput('aws-role') || process.env.SCAFFOLDLY_AWS_ROLE;

    const idToken = await this.idToken;

    try {
      if (!role || !role.trim()) {
        throw new Error(
          `Unknown or missing role. Please make sure SCAFFOLDLY_AWS_ROLE is set in GitHub Actions Variables.`,
        );
      }

      let client = new STSClient({ region });
      const assumeResponse = await client.send(
        new AssumeRoleWithWebIdentityCommand({
          WebIdentityToken: idToken,
          RoleArn: role,
          RoleSessionName: `gha-${context.runNumber}-${context.runId}`,
        }),
      );

      const {
        AccessKeyId: accessKeyId,
        SecretAccessKey: secretAccessKey,
        SessionToken: sessionToken,
      } = assumeResponse.Credentials || {};

      if (!accessKeyId || !secretAccessKey || !sessionToken) {
        throw new Error('Unable to assume role');
      }

      exportVariable('AWS_DEFAULT_REGION', region);
      exportVariable('AWS_REGION', region);
      exportVariable('AWS_ACCESS_KEY_ID', accessKeyId);
      exportVariable('AWS_SECRET_ACCESS_KEY', secretAccessKey);
      exportVariable('AWS_SESSION_TOKEN', sessionToken);

      client = new STSClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
          sessionToken,
        },
      });

      const callerIdentity = await client.send(new GetCallerIdentityCommand({}));

      notice(`Deploying as ${callerIdentity.Arn} using ${role}...`);
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }

      error(`Failed to assume role: ${e.message}`);
      debug(`Error: ${e}`);

      const newLongMessage = await roleSetupMoreInfo(status);

      status.failed = true;
      status.shortMessage = e.message;
      status.longMessage = newLongMessage;
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
