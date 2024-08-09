import { hideBin } from 'yargs/helpers';
import { isAxiosError } from 'axios';
import { OutputType, ShowCommand, ShowSubcommands } from './commands/show';
import inquirer, { Answers, QuestionCollection } from 'inquirer';
import { NoTokenError } from './stores/scms';
import { GithubHelper } from './helpers/githubHelper';
import { LoginCommand } from './commands/login';
import { MessagesHelper } from './helpers/messagesHelper';
import { version } from '../../package.json';
import { ApiHelper } from './helpers/apiHelper';
import { NOT_LOGGED_IN } from './messages';
import { ErrorWithReturnCode, RETURN_CODE_NOT_LOGGED_IN } from './errors';
import { outputStream } from '../scaffoldly';
import { BottomBar, isHeadless } from './ui';
import Prompt from 'inquirer/lib/ui/prompt';
import { DevCommand } from './commands/ci/dev';
import { BuildCommand } from './commands/ci/build';
import { DeployCommand } from './commands/cd/deploy';

process.addListener('SIGINT', () => {
  console.log('Exiting!');
  process.exit(0);
});

export const ui = new BottomBar(outputStream);

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

  private login: LoginCommand;

  private dev: DevCommand;

  private build: BuildCommand;

  private deploy: DeployCommand;

  private show: ShowCommand;

  constructor(argv: string[]) {
    this.apiHelper = new ApiHelper(argv);
    this.messagesHelper = new MessagesHelper(argv);
    this.show = new ShowCommand(this.apiHelper, this.messagesHelper);
    this.login = new LoginCommand(this.apiHelper, this.messagesHelper);
    this.dev = new DevCommand();
    this.build = new BuildCommand();
    this.deploy = new DeployCommand();
  }

  public async run(argv: string[]): Promise<void> {
    const yargs = (await import('yargs')).default;
    const ya = yargs()
      .scriptName(this.messagesHelper.processName)
      .command({
        command: 'identity',
        describe: `Show the current user identity`,
        handler: ({ withToken, output }) =>
          this.loginWrapper(
            () =>
              this.show.handle(
                'identity' as ShowSubcommands,
                withToken as string | undefined,
                output as OutputType | undefined,
              ),
            isHeadless(),
            withToken as string | undefined,
          ),
        builder: {
          withToken: {
            demand: false,
            type: 'string',
            description: 'Skip authentication and save the provided token to ~/.scaffoldly/',
          },
          output: {
            alias: 'o',
            demand: false,
            type: 'string',
            description: 'Output format',
            choices: ['table', 'json'],
            default: 'table',
          },
        },
      })
      .command({
        command: 'login',
        describe: `Login to Scaffoldly`,
        handler: ({ withToken }) =>
          this.loginWrapper(
            () => this.login.handle(withToken as string | undefined),
            isHeadless(),
            withToken as string | undefined,
          ),
        builder: {
          withToken: {
            demand: false,
            type: 'string',
            description: 'Skip authentication and save the provided token to ~/.scaffoldly/',
          },
        },
      })
      .command({
        command: 'dev',
        describe: `Launch a development environment`,
        handler: ({ withToken }) =>
          this.loginWrapper(() => this.dev.handle(), isHeadless(), withToken as string | undefined),
        builder: {
          withToken: {
            demand: false,
            type: 'string',
            description: 'Skip authentication and save the provided token to ~/.scaffoldly/',
          },
        },
      })
      .command({
        command: 'build',
        describe: `Build the environment`,
        handler: ({ withToken }) =>
          this.loginWrapper(
            () => this.build.handle(),
            isHeadless(),
            withToken as string | undefined,
          ),
        builder: {
          withToken: {
            demand: false,
            type: 'string',
            description: 'Skip authentication and save the provided token to ~/.scaffoldly/',
          },
        },
      })
      .command({
        command: 'deploy',
        describe: `Deploy the environment`,
        handler: ({ withToken }) =>
          this.loginWrapper(
            () => this.deploy.handle(),
            isHeadless(),
            withToken as string | undefined,
          ),
        builder: {
          withToken: {
            demand: false,
            type: 'string',
            description: 'Skip authentication and save the provided token to ~/.scaffoldly/',
          },
        },
      })
      .help()
      .wrap(null)
      .version(version)
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
          const githubLogin = new GithubHelper(this.apiHelper, this.messagesHelper);
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
