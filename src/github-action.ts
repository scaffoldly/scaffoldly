import { onExit } from 'signal-exit';
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
  setOutput,
} from '@actions/core';

onExit((code, signal) => {
  if (code !== 0) {
    console.warn(`Recived exit code: ${code}, signal: ${signal}`);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(-1);
});

process.on('uncaughtException', (err) => {
  console.warn('Uncaught Exception:', err);
  process.exit(-1);
});

export const run = async (mode: Mode, version?: string): Promise<void> => {
  const action = await new Action(mode, version).init();
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
    setOutput('url', status.url);

    if (status.failed) {
      throw new Error(`${mode} step failed: ${status.shortMessage}`);
    }
  } catch (e) {
    if (e instanceof Error) {
      debug(`${e}`);
      if (e.cause && e.cause instanceof Error) {
        error(`Error: ${e.message}:\n  ${e.cause.message}`);
        debug(`Cause: ${e.cause}`);
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
