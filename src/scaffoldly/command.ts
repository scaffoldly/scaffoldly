import { hideBin } from 'yargs/helpers';
import { isAxiosError } from 'axios';
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
import { DeployCommand, PresetType, PRESETS } from './commands/deploy';
import { GitService } from './commands/cd/git';
import { EventService } from './event';
import { run as createApp } from '../create-app';

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

  private eventService: EventService;

  constructor(argv: string[], private version?: string) {
    this.eventService = new EventService('Cli', this.version, true)
      .withArgs(argv.slice(2))
      .withSessionId(undefined);
    this.apiHelper = new ApiHelper(argv, this.eventService);
    this.messagesHelper = new MessagesHelper(argv);
    this.gitService = new GitService(this.eventService);
  }

  public async run(argv: string[]): Promise<void> {
    const yargs = (await import('yargs')).default;
    const ya = yargs()
      .scriptName(this.messagesHelper.processName)
      .command('create', 'Create Scaffoldly resources', (create) => {
        create
          .scriptName(this.messagesHelper.processName)
          .command({
            command: 'app',
            describe: 'Generate a new scaffoldly application from a template',
            handler: async () => {
              // TODO: Migrate to the Command class
              return createApp();
            },
          })
          .help()
          .wrap(null);
      })
      .command('show', 'Display config, dockerfiles, etc.', (show) => {
        show
          .scriptName(this.messagesHelper.processName)
          .command({
            command: 'dockerfile',
            describe: `Show the generated Dockerfile`,
            handler: async ({ preset, development }) => {
              const cmd = await new DeployCommand(this.gitService)
                .withMode(development ? 'development' : undefined)
                .withPreset(preset);
              return cmd.handle('dockerfile');
            },
            builder: {
              preset: {
                demand: false,
                type: 'string',
                choices: PRESETS,
                nargs: 1,
                description: 'Use a preset configuration',
              },
              development: {
                demand: false,
                type: 'boolean',
                default: false,
                requiresArg: false,
                description: "Show in development mode. The 'dev' scripts will be used.",
              },
            },
          })
          .command({
            command: 'config',
            describe: `Show the effective configuration`,
            handler: async ({ preset, save }) => {
              const cmd = await new DeployCommand(this.gitService).withPreset(preset);
              if (save) {
                return cmd.handle('save-config');
              }
              return cmd.handle('show-config');
            },
            builder: {
              preset: {
                demand: false,
                type: 'string',
                choices: PRESETS,
                nargs: 1,
                description: 'Use a preset configuration',
              },
              save: {
                demand: false,
                type: 'boolean',
                default: false,
                requiresArg: false,
                description: 'Save the preset configuration.',
              },
            },
          })
          .command({
            command: 'permissions',
            describe: `Show the necessary permissions for deployment`,
            handler: async ({ development }) => {
              const cmd = new DeployCommand(this.gitService)
                .withMode(development ? 'development' : undefined)
                .withOptions({ checkPermissions: true });
              return cmd.handle();
            },
            builder: {
              development: {
                demand: false,
                type: 'boolean',
                default: false,
                requiresArg: false,
                description: "Show in development mode. The 'dev' scripts will be used.",
              },
            },
          })
          .help()
          .wrap(null);
      })
      .command({
        command: 'dev',
        describe: `[ALPHA FEATURE] Launch a development environment`,
        handler: ({ withToken, production, preset }) =>
          this.loginWrapper(
            async () => {
              const dev = await new DevCommand(this.gitService)
                .withMode(production ? 'production' : undefined)
                .withPreset(preset as PresetType | undefined);
              return dev.handle();
            },
            isHeadless(),
            withToken as string | undefined,
          ),
        builder: {
          withToken: {
            demand: false,
            type: 'string',
            nargs: 1,
            description: 'Use a provided GitHub Token',
            hidden: true,
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
            choices: PRESETS,
            nargs: 1,
            description: 'Use a preset configuration',
          },
        },
      })
      .command({
        command: 'deploy',
        describe: `Deploy an environment`,
        handler: (args) =>
          this.loginWrapper(async () => {
            const development = args.development as boolean | undefined;
            const buildOnly = args['build-only'] as boolean | undefined;
            const preset = args.preset as PresetType | undefined;
            const dryrun = args.dryrun as boolean | undefined;
            const deploy = await new DeployCommand(this.gitService)
              .withMode(development ? 'development' : undefined)
              .withOptions({ dryRun: dryrun || false, buildOnly: buildOnly || false })
              .withPreset(preset as PresetType | undefined);
            return deploy.handle();
          }, isHeadless()),
        builder: {
          withToken: {
            demand: false,
            type: 'string',
            nargs: 1,
            description: 'Use a provided GitHub token.',
            hidden: true,
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
            choices: PRESETS,
            nargs: 1,
            description: 'Use a preset configuration.',
          },
          'build-only': {
            demand: false,
            type: 'boolean',
            default: false,
            requiresArg: false,
            description: 'Only perform a build. Deployment to the cloud will not occur.',
          },
          dryrun: {
            demand: false,
            type: 'boolean',
            default: false,
            requiresArg: false,
            description: 'Dry run mode. Propsed changes will be displayed.',
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
