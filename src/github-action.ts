import { Action, Mode } from './github-action/action';
import { State } from './github-action/state';
import {
  saveState,
  getState,
  debug,
  // setOutput,
  summary,
  error,
  info,
} from '@actions/core';

process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(-1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(-1);
});

export const run = async (mode: Mode): Promise<void> => {
  const action = await new Action(mode).init();
  let state: State = { status: {} };

  try {
    switch (mode) {
      case 'pre':
        state = await action.pre(state);
        break;
      case 'main':
        state = await action.main(JSON.parse(getState('state') || '{}') as State);
        break;
      case 'post':
        state = await action.post(JSON.parse(getState('state') || '{}') as State);
        break;
      default:
        throw new Error(`Invalid mode: ${mode}`);
    }

    debug('New state: ' + JSON.stringify(state));

    if (mode === 'post' && state.longMessage) {
      summary.addRaw(state.longMessage, true);
      await summary.write({ overwrite: true });
    }

    saveState('state', JSON.stringify(state));
    // setOutput('TODO', 'TODO');

    if (state.failed) {
      throw new Error(`${mode} step failed: ${state.shortMessage}`);
    }
  } catch (e) {
    if (e instanceof Error) {
      debug(`${e}`);
      if (e.cause && e.cause instanceof Error) {
        error(`Error: ${e.message}:\n  ${e.cause.message}`);
      } else {
        error(`Error: ${e.message}`);
      }
      info(`\nRe-run the action with debug enabled for more information.`);
    } else {
      error(`${e}`);
    }
    process.exit(-1);
  }
};
