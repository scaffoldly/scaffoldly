import { debug, getIDToken, exportVariable, notice, getInput, error } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { warn } from 'console';
import {
  STSClient,
  AssumeRoleWithWebIdentityCommand,
  GetCallerIdentityCommand,
} from '@aws-sdk/client-sts';
import { deployedMarkdown, failedMarkdown, roleSetupMoreInfo } from './messages';
import { State } from './state';
import { GitService } from '../scaffoldly/commands/cd/git';
import { DeployCommand } from '../scaffoldly/commands/cd/deploy';
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

  _stage?: string;

  constructor(private mode: Mode) {
    this.gitService = new GitService(this.cwd);
    this.apiHelper = new ApiHelper(process.argv);
    this.messagesHelper = new MessagesHelper(process.argv);
    this.scms = new Scms(this.apiHelper, this.messagesHelper, this.gitService);
  }

  async init(): Promise<Action> {
    debug('Initializing action...');
    this._token = await this.scms.getGithubToken(getInput('github-token'));
    this._stage = await this.gitService.stage;
    this._branch = await this.gitService.branch;
    this._sha = await this.gitService.sha;

    return this;
  }

  async pre(state: State): Promise<State> {
    state.deployStatus = {};
    state.deployLogsUrl = await this.logsUrl;
    state.commitSha = this.commitSha;

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

      const newLongMessage = await roleSetupMoreInfo(this.owner, this.repo, state);

      state.failed = true;
      state.shortMessage = e.message;
      state.longMessage = newLongMessage;
    }

    return state;
  }

  async main(state: State): Promise<State> {
    debug(`state: ${JSON.stringify(state)}`);

    if (state.failed) {
      debug('state: ' + JSON.stringify(state));
      notice(`Deployment skipped due to failure...`);
      return state;
    }

    const deployCommand = new DeployCommand(this.gitService);

    try {
      await deployCommand.handle(state.deployStatus, {
        notify: (message, level) => {
          if (level === 'error') {
            error(message);
          } else {
            notice(message);
          }
        },
      });
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }

      state.failed = true;
      state.shortMessage = e.message;
      state.longMessage = 'TODO: Implement long message';
    }

    return state;
  }

  async post(state: State): Promise<State> {
    debug(`state: ${JSON.stringify(state)}`);

    if (!state.failed) {
      const { longMessage, shortMessage } = await deployedMarkdown(state);
      state.shortMessage = shortMessage;
      state.longMessage = longMessage;
    } else {
      const { longMessage, shortMessage } = await failedMarkdown(state, state.longMessage);
      state.shortMessage = shortMessage;
      state.longMessage = longMessage;
    }

    return state;
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
          warn(`Unable to infer logs URL: ${e.message}`);
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
        if (this.mode === 'pre') {
          return undefined;
        }
        throw new Error(`Unable to change working directory to ${cwd}: ${e.message}`);
      }
    }

    return cwd;
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
