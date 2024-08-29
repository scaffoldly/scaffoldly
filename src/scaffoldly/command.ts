import { hideBin } from 'yargs/helpers';
import { isAxiosError } from 'axios';
import { ShowCommand } from './commands/show';
import inquirer, { Answers, QuestionCollection } from 'inquirer';
import { NoTokenError } from './stores/scms';
import { GithubHelper } from './helpers/githubHelper';
import { MessagesHelper } from './helpers/messagesHelper';
import { ApiHelper } from './helpers/apiHelper';
import { NOT_LOGGED_IN } from './messages';
import { ErrorWithReturnCode, RETURN_CODE_NOT_LOGGED_IN } from './errors';
import { outputStream } from '../scaffoldly';
import { BottomBar, isHeadless } from './ui';
import Prompt from 'inquirer/lib/ui/prompt';
import { DevCommand } from './commands/dev';
import { DeployCommand, Preset } from './commands/deploy';
import { GitService } from './commands/cd/git';

export const ui = new BottomBar(process.stderr);

export const prompt = (
  field: string,
  questions: QuestionCollection<Answers>,
  initialAnswers?: Partial<Answers>,
  stream?: NodeJS.WriteStream,
): Promise<Answers> & { ui: Prompt<Answers> } => {
  if (!process.stdin.isTTY) {
    throw new Error(`TTY was disabled while attempting to collect \`${field}\`.`);
  }
  return inquirer.createPromptModule({ output: stream || outputStream })(questions, initialAnswers);
};

export class Command {
  private apiHelper: ApiHelper;

  private messagesHelper: MessagesHelper;

  private gitService: GitService;

  constructor(argv: string[], private version?: string) {
    this.apiHelper = new ApiHelper(argv);
    this.messagesHelper = new MessagesHelper(argv);
    this.gitService = new GitService(process.cwd());
  }

  public async run(argv: string[]): Promise<void> {
    const yargs = (await import('yargs')).default;
    const ya = yargs()
      .scriptName(this.messagesHelper.processName)
      .command({
        command: 'identity',
        describe: `Show the current user identity`,
        handler: ({ withToken }) =>
          this.loginWrapper(
            async () => {
              const show = await new ShowCommand(
                this.apiHelper,
                this.messagesHelper,
                this.gitService,
              )
                .withSubcommand('identity')
                .withPreset();
              return show.handle();
            },
            isHeadless(),
            withToken as string | undefined,
          ),
        builder: {
          withToken: {
            demand: false,
            type: 'string',
            description: 'Use a provided GitHub Token',
          },
        },
      })
      .command({
        command: 'dockerfile',
        describe: `Show the generated dockerfile`,
        handler: ({ withToken, preset }) =>
          this.loginWrapper(
            async () => {
              const show = await new ShowCommand(
                this.apiHelper,
                this.messagesHelper,
                this.gitService,
              )
                .withSubcommand('dockerfile')
                .withPreset(preset);
              return show.handle();
            },
            isHeadless(),
            withToken as string | undefined,
          ),
        builder: {
          withToken: {
            demand: false,
            type: 'string',
            description: 'Use a provided GitHub Token',
          },
          preset: {
            demand: false,
            type: 'string',
            choices: ['nextjs'],
            description: 'Use a preset configuration',
          },
        },
      })
      .command({
        command: 'dev',
        describe: `Launch a development environment`,
        handler: ({ withToken, production, preset }) =>
          this.loginWrapper(
            async () => {
              const dev = await new DevCommand(this.gitService)
                .withMode(production ? 'production' : 'development')
                .withPreset(preset as Preset | undefined);
              return dev.handle();
            },
            isHeadless(),
            withToken as string | undefined,
          ),
        builder: {
          withToken: {
            demand: false,
            type: 'string',
            description: 'Use a provided GitHub Token',
          },
          production: {
            demand: false,
            type: 'boolean',
            default: false,
            requiresArg: false,
            description: "Run in production mode. The 'start' scripts will be used.",
          },
          preset: {
            demand: false,
            type: 'string',
            choices: ['nextjs'],
            description: 'Use a preset configuration',
          },
        },
      })
      .command({
        command: 'deploy',
        describe: `Deploy an environment`,
        handler: ({ withToken, development, preset }) =>
          this.loginWrapper(
            async () => {
              const deploy = await new DeployCommand(this.gitService)
                .withMode(development ? 'development' : 'production')
                .withPreset(preset as Preset | undefined);
              return deploy.handle();
            },
            isHeadless(),
            withToken as string | undefined,
          ),
        builder: {
          withToken: {
            demand: false,
            type: 'string',
            description: 'Use a provided GitHub token',
          },
          development: {
            demand: false,
            type: 'boolean',
            default: false,
            requiresArg: false,
            description: "Deploy in development mode. The 'dev' scripts will be used.",
          },
          preset: {
            demand: false,
            type: 'string',
            choices: ['nextjs'],
            description: 'Use a preset configuration',
          },
        },
      })
      .help()
      .wrap(null)
      .version(this.version || 'latest')
      .fail((_msg, error) => {
        if (isAxiosError(error)) {
          if (error.response && error.response.status === 401) {
            ui.updateBottomBar('');
            console.error(NOT_LOGGED_IN(this.messagesHelper.processName));
          } else {
            ui.updateBottomBar('');
            console.error(
              `API Error: ${
                (error.response &&
                  error.response.data &&
                  (error.response.data as { message: string }).message) ||
                error.message
              }`,
            );
          }
        } else {
          ui.updateBottomBar('');
          throw error;
        }
      });

    const parsed = await ya.parse(hideBin(argv));

    if (parsed._.length === 0) {
      ya.showHelp();
    }
  }

  private loginWrapper = async (
    fn: () => Promise<void>,
    headless = false,
    withToken?: string,
  ): Promise<void> => {
    try {
      await fn();
    } catch (e) {
      if (e instanceof NoTokenError) {
        if (!headless) {
          const githubLogin = new GithubHelper(
            this.apiHelper,
            this.messagesHelper,
            this.gitService,
          );
          await githubLogin.promptLogin(withToken);
          await fn();
        } else {
          throw new ErrorWithReturnCode(
            RETURN_CODE_NOT_LOGGED_IN,
            NOT_LOGGED_IN(this.messagesHelper.processName),
          );
        }
      } else {
        throw e;
      }
    }
  };
}
