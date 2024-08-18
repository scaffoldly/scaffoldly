import { Action } from './github-action/action';
import { State } from './github-action/state';
import { saveState, getState, debug, setOutput, summary, error } from '@actions/core';

export const run = async (stage?: 'pre' | 'main' | 'post'): Promise<void> => {
  const action = new Action();

  let state: State = {};

  try {
    switch (stage) {
      case 'pre':
        state = await action.pre(state);
        break;
      case 'main':
        state = await action.main(JSON.parse(getState('state')) as State);
        break;
      case 'post':
        state = await action.post(JSON.parse(getState('state')) as State);
        break;
      default:
        throw new Error(`Invalid stage: ${stage}`);
    }

    debug('New state: ' + JSON.stringify(state));

    setOutput('stage', state.stage);
    setOutput('deployed', state.action === 'deploy');
    setOutput('destroyed', state.action === 'destroy');

    if (state.httpApiUrl) {
      setOutput('httpApiUrl', state.httpApiUrl);
    }

    if (state.failed) {
      state = await action.updateDeployment(state, 'failure');
      state.shortMessage = undefined;
    }

    if (stage === 'post' && state.longMessage) {
      summary.addRaw(state.longMessage, true);
      await summary.write({ overwrite: true });
    }

    saveState('state', JSON.stringify(state));

    if (state.failed) {
      process.exit(1);
    }

    process.exit(0);
  } catch (e) {
    error(`Uncaught Error: ${e}`);
    process.exit(1);
  }
};
