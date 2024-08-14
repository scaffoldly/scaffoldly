import { hideBin } from 'yargs/helpers';
import { isAxiosError } from 'axios';
import { ShowCommand, ShowSubcommands } from './commands/show';
import inquirer, { Answers, QuestionCollection } from 'inquirer';
import { NoTokenError } from './stores/scms';
import { GithubHelper } from './helpers/githubHelper';
import { MessagesHelper } from './helpers/messagesHelper';
import { version } from '../../package.json';
import { ApiHelper } from './helpers/apiHelper';
import { NOT_LOGGED_IN } from './messages';
import { ErrorWithReturnCode, RETURN_CODE_NOT_LOGGED_IN } from './errors';
import { outputStream } from '../scaffoldly';
import { BottomBar, isHeadless } from './ui';
import Prompt from 'inquirer/lib/ui/prompt';
import { DevCommand } from './commands/ci/dev';
import { DeployCommand } from './commands/cd/deploy';
import { GitService } from './commands/cd/git';

process.addListener('SIGINT', () => {
  console.log('Exiting!');
  process.exit(0);
});

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

  private dev: DevCommand;

  private deploy: DeployCommand;

  private show: ShowCommand;

  private gitService: GitService;

  constructor(argv: string[]) {
    this.apiHelper = new ApiHelper(argv);
    this.messagesHelper = new MessagesHelper(argv);
    this.gitService = new GitService();
    this.dev = new DevCommand(this.gitService);
    this.deploy = new DeployCommand(this.gitService);
    this.show = new ShowCommand(this.apiHelper, this.messagesHelper, this.gitService);
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
            () => this.show.handle('identity' as ShowSubcommands, withToken as string | undefined),
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
        handler: ({ withToken }) =>
          this.loginWrapper(
            () => this.show.handle('dockerfile' as ShowSubcommands),
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
        command: 'dev',
        describe: `Launch a development environment`,
        handler: ({ withToken }) =>
          this.loginWrapper(() => this.dev.handle(), isHeadless(), withToken as string | undefined),
        builder: {
          withToken: {
            demand: false,
            type: 'string',
            description: 'Use a provided GitHub Token',
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
            description: 'Use a provided GitHub token',
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
