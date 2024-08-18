import { debug, getIDToken, exportVariable, notice, getInput, setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { warn } from 'console';
import {
  STSClient,
  AssumeRoleWithWebIdentityCommand,
  GetCallerIdentityCommand,
} from '@aws-sdk/client-sts';
import {
  deployedMarkdown,
  deployingMarkdown,
  destroyedMarkdown,
  destroyingMarkdown,
  failedMarkdown,
  preparingMarkdown,
  roleSetupMoreInfo,
} from './messages';
import { boolean } from 'boolean';
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

  _owner?: string;

  _repo?: string;

  _token?: string;

  _sha?: string;

  _ref?: string;

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
    this._owner = await this.gitService.owner;
    this._repo = await this.gitService.repo;
    this._branch = await this.gitService.branch;
    this._token = await this.scms.getGithubToken(getInput('github-token'));
    this._sha = await this.gitService.sha;
    this._ref = await this.gitService.ref;
    this._stage = await this.gitService.stage;
    return this;
  }

  async pre(state: State): Promise<State> {
    state.stage = this.stage;

    exportVariable('STAGE', state.stage);

    if (boolean(getInput('destroy') || 'false') === true) {
      notice(`Destruction enabled. Destroying ${this.stage}...`);
      state.action = 'destroy';
    } else if (context.eventName === 'pull_request' && context.payload.action === 'closed') {
      notice(`Pull request has been closed. Destroying ${this.stage}...`);
      state.action = 'destroy';
    } else if (
      context.eventName === 'workflow_dispatch' &&
      boolean(this.workflowInputs.destroy) === true
    ) {
      notice(`Workflow dispatch triggered with destruction enabled. Destroying ${this.stage}...`);
      state.action = 'destroy';
    } else {
      state.action = 'deploy';
    }

    const region =
      getInput('aws-region') ||
      process.env.AWS_DEFAULT_REGION ||
      process.env.AWS_REGION ||
      'us-east-1';
    const role = getInput('aws-role') || process.env.SCAFFOLDLY_AWS_ROLE;

    const idToken = await this.idToken;
    const logsUrl = await this.logsUrl;

    const { shortMessage, longMessage } = await preparingMarkdown(
      this.commitSha,
      this.stage,
      logsUrl,
    );
    state.shortMessage = shortMessage;
    state.longMessage = longMessage;

    state = await this.createDeployment(state);

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
          RoleSessionName: `${this.owner}-${this.repo}-${context.runNumber}-${context.runId}`,
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

      const newLongMessage = await roleSetupMoreInfo(this.owner, this.repo, await this.logsUrl);

      return {
        ...state,
        action: undefined,
        failed: true,
        shortMessage: e.message,
        longMessage: newLongMessage,
      };
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

    const logsUrl = await this.logsUrl;

    if (state.action === 'deploy') {
      const { shortMessage, longMessage } = await deployingMarkdown(
        this.commitSha,
        this.stage,
        logsUrl,
      );
      state.shortMessage = shortMessage;
      state.longMessage = longMessage;
    }

    if (state.action === 'destroy') {
      const { shortMessage, longMessage } = await destroyingMarkdown(
        this.commitSha,
        this.stage,
        logsUrl,
      );
      state.shortMessage = shortMessage;
      state.longMessage = longMessage;
    }

    await this.updateDeployment(state, 'in_progress');

    const deployCommand = new DeployCommand(this.gitService);

    if (state.action === 'destroy') {
      // TODO: Ensure not a protected branch
      //       - If so, make sure destroy on action is explicitly set
      notice(`Destroying ${this.stage}...`);
      throw new Error('Not implemented');
    }

    if (state.action === 'deploy') {
      notice(`Deploying ${this.stage}...`);

      try {
        const status = await deployCommand.handle();
        console.log('!!! deploy status', status);
      } catch (e) {
        if (!(e instanceof Error)) {
          throw e;
        }

        return {
          ...state,
          action: 'deploy',
          failed: true,
          shortMessage: e.message,
          longMessage: 'TODO: Implement long message',
        };
      }
    }

    return state;
  }

  async post(state: State): Promise<State> {
    debug(`state: ${JSON.stringify(state)}`);

    state.httpApiUrl = await this.httpApiUrl;
    const logsUrl = await this.logsUrl;

    if (!state.failed) {
      if (state.action === 'deploy') {
        const { longMessage, shortMessage } = await deployedMarkdown(
          this.commitSha,
          this.stage,
          state.httpApiUrl,
          logsUrl,
        );
        state.shortMessage = shortMessage;
        state.longMessage = longMessage;
      } else if (state.action === 'destroy') {
        const { longMessage, shortMessage } = await destroyedMarkdown(
          this.commitSha,
          this.stage,
          logsUrl,
        );
        state.shortMessage = shortMessage;
        state.longMessage = longMessage;
      }
    } else {
      const { longMessage, shortMessage } = await failedMarkdown(
        this.commitSha,
        this.stage,
        logsUrl,
        state.longMessage,
      );
      state.shortMessage = state.shortMessage || shortMessage;
      state.longMessage = longMessage;
    }

    const status = state.failed ? 'failure' : state.action === 'destroy' ? 'inactive' : 'success';
    state = await this.updateDeployment(state, status);

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

  get stage(): string {
    if (!this._stage) {
      throw new Error('Unable to determine stage. Was init() called?');
    }
    return this._stage;
  }

  get owner(): string {
    if (!this._owner) {
      throw new Error('Unable to determine owner. Was init() called?');
    }
    return this._owner;
  }

  get repo(): string {
    if (!this._repo) {
      throw new Error('Unable to determine repo. Was init() called?');
    }
    return this._repo;
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

  get prNumber(): number | undefined {
    return this.gitService.prNumber;
  }

  get workflowInputs(): { [key: string]: string } {
    return context.payload.inputs || {};
  }

  get ref(): string {
    if (!this._ref) {
      throw new Error('Unable to determine ref. Was init() called?');
    }
    return this._ref;
  }

  async createDeployment(state: State): Promise<State> {
    const octokit = getOctokit(this.token);

    const { prNumber, ref } = this;

    try {
      const response = await octokit.rest.repos.createDeployment({
        ref,
        required_contexts: [],
        environment: this.stage,
        transient_environment: !!this.prNumber,
        auto_merge: false,
        owner: this.owner,
        repo: this.repo,
        task: context.job,
        payload: {},
        production_environment: this.stage === 'production',
        description: state.shortMessage,
      });

      if (typeof response.data === 'number') {
        state.deploymentId = response.data;
      } else if ('id' in response.data) {
        state.deploymentId = response.data.id;
      }
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }

      warn(`Unable to create deployment: ${e.message}`);
      state.deploymentId = undefined;
    }

    if (prNumber && state.longMessage) {
      const response = await octokit.rest.issues.createComment({
        body: state.longMessage,
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
      });

      state.commentId = response.data.id;
    }

    return state;
  }

  async updateDeployment(
    state: State,
    status: 'success' | 'failure' | 'in_progress' | 'inactive',
  ): Promise<State> {
    const octokit = getOctokit(this.token);
    const { deploymentId, commentId } = state;

    if (status === 'failure' && state.shortMessage) {
      setFailed(state.shortMessage);
    }

    if (deploymentId) {
      try {
        await octokit.rest.repos.createDeploymentStatus({
          deployment_id: deploymentId,
          state: status,
          environment_url: await this.httpApiUrl,
          log_url: await this.logsUrl,
          environment: this.stage,
          owner: this.owner,
          repo: this.repo,
          description: state.shortMessage,
        });
        notice(`Updated deployment for ${this.stage} to ${status}`);
      } catch (e) {
        if (!(e instanceof Error)) {
          throw e;
        }

        warn(`Unable to update deployment ${deploymentId}: ${e.message}`);
      }
    }

    // If state is inactive:
    // - Mark all deployments as inactive
    // - If its a PR:
    //    - Delete the deployment
    //    - Delete the environment
    if (status === 'inactive') {
      const deployments = await octokit.paginate(octokit.rest.repos.listDeployments, {
        owner: this.owner,
        repo: this.repo,
        environment: this.stage,
      });

      await Promise.all(
        deployments.map(async (deployment) => {
          if (deployment.id === deploymentId) {
            return;
          }

          try {
            debug(`Deactivating deployment ${deployment.id}`);
            await octokit.rest.repos.createDeploymentStatus({
              deployment_id: deployment.id,
              state: 'inactive',
              environment: this.stage,
              owner: this.owner,
              repo: this.repo,
            });
          } catch (e) {
            if (!(e instanceof Error)) {
              throw e;
            }

            warn(`Unable to deactivate deployment ${deployment.id}: ${e.message}`);
          }
        }),
      );

      if (this.prNumber) {
        await Promise.all(
          deployments.map(async (deployment) => {
            try {
              debug(`Deleting deployment ${deployment.id}`);
              await octokit.rest.repos.deleteDeployment({
                deployment_id: deployment.id,
                owner: this.owner,
                repo: this.repo,
              });
            } catch (e) {
              if (!(e instanceof Error)) {
                throw e;
              }

              warn(`Unable to delete deployment ${deployment.id}: ${e.message}`);
            }
          }),
        );

        try {
          await octokit.rest.repos.deleteAnEnvironment({
            environment_name: this.stage,
            owner: this.owner,
            repo: this.repo,
          });
          notice(`Deleted environment ${this.stage}`);
        } catch (e) {
          if (!(e instanceof Error)) {
            throw e;
          }

          warn(`Unable to delete environment ${this.stage}: ${e.message}`);
        }
      }
    }

    if (commentId && state.longMessage) {
      debug(`Updating PR comment ${commentId}`);

      await octokit.rest.issues.updateComment({
        comment_id: commentId,
        body: state.longMessage,
        owner: this.owner,
        repo: this.repo,
        issue_number: this.prNumber,
      });
    }

    return state;
  }

  get serverlessState(): Promise<{ foo: string } | undefined> {
    return Promise.resolve(undefined);
    // return new Promise(async (resolve) => {
    //   try {
    //     const serverlessState = JSON.parse(
    //       fs.readFileSync(path.join('.serverless', 'serverless-state.json'), 'utf8'),
    //     );
    //     resolve(serverlessState);
    //   } catch (e) {
    //     warn('No serverless state found.');
    //     debug(`Caught Error: ${e}`);
    //     resolve(undefined);
    //   }
    // });
  }

  get stack(): Promise<{ foo: string } | undefined> {
    return Promise.resolve(undefined);
    // return new Promise(async (resolve) => {
    //   const serverlessState = await this.serverlessState;
    //   if (!serverlessState) {
    //     resolve(undefined);
    //     return;
    //   }
    //   const stackName = `${serverlessState.service.service}-${serverlessState.service.provider.stage}`;
    //   const client = new CloudFormationClient({ region: serverlessState.service.provider.region });
    //   const describeStacks = await client.send(new DescribeStacksCommand({ StackName: stackName }));
    //   const stack = describeStacks.Stacks?.find(
    //     (s) =>
    //       s.StackName === stackName &&
    //       s.Tags?.find(
    //         (t) => t.Key === 'STAGE' && t.Value === serverlessState.service.provider.stage,
    //       ),
    //   );
    //   if (!stack) {
    //     warn('Unable to find stack.');
    //     debug(JSON.stringify(describeStacks));
    //     resolve(undefined);
    //     return;
    //   }
    //   resolve(stack);
    // });
  }

  get httpApiUrl(): Promise<string | undefined> {
    return Promise.resolve(undefined);
    //   return new Promise(async (resolve) => {
    //     const stack = await this.stack;

    //     if (!stack) {
    //       resolve(undefined);
    //       return;
    //     }

    //     resolve(stack.Outputs?.find((o) => o.OutputKey === 'HttpApiUrl')?.OutputValue);
    //   });
    // }
  }
}
