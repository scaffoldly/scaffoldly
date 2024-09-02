import { Action, Mode } from './github-action/action';
import { Status } from './github-action/status';
import {
  saveState,
  getState,
  debug,
  // setOutput,
  summary,
  error,
  info,
} from '@actions/core';

export const run = async (mode: Mode): Promise<void> => {
  const action = await new Action(mode).init();
  let state: Status = {};

  try {
    switch (mode) {
      case 'pre':
        state = await action.pre(state);
        break;
      case 'main':
        state = await action.main(JSON.parse(getState('state') || '{}') as Status);
        break;
      case 'post':
        state = await action.post(JSON.parse(getState('state') || '{}') as Status);
        break;
      default:
        throw new Error(`Invalid mode: ${mode}`);
    }

    debug(`New state: ${state}`);

    if (mode === 'post' && state.longMessage) {
      summary.addRaw(state.longMessage, true);
      await summary.write({ overwrite: true });
    }

    saveState('state', state);
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
