import { decode, encode } from './config';
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
  let status: Status = {};

  try {
    switch (mode) {
      case 'pre':
        status = await action.pre(status);
        break;
      case 'main':
        status = await action.main(decode(getState('status')) as Status);
        break;
      case 'post':
        status = await action.post(decode(getState('status')) as Status);
        break;
      default:
        throw new Error(`Invalid mode: ${mode}`);
    }

    debug(`New status: ${JSON.stringify(status)}`);

    if (mode === 'post' && status.longMessage) {
      summary.addRaw(status.longMessage, true);
      await summary.write({ overwrite: true });
    }

    saveState('status', encode(status));
    // setOutput('TODO', 'TODO');

    if (status.failed) {
      throw new Error(`${mode} step failed: ${status.shortMessage}`);
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
