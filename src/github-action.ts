import { Action, Mode } from './github-action/action';
import { State } from './github-action/state';
import { saveState, getState, debug, setOutput, summary, error } from '@actions/core';

process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
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
        throw new Error(`Invalid run: ${run}`);
    }

    debug('New state: ' + JSON.stringify(state));

    setOutput('TODO', 'TODO');

    if (mode === 'post' && state.longMessage) {
      summary.addRaw(state.longMessage, true);
      await summary.write({ overwrite: true });
    }

    saveState('state', JSON.stringify(state));

    if (state.failed) {
      process.exit(1);
    }

    process.exit(0);
  } catch (e) {
    error(e);
    debug(e.stack);
    process.exit(1);
  }
};
