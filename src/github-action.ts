import { Action } from './github-action/action';
import { State } from './github-action/state';
import { saveState, getState, debug, setOutput, summary } from '@actions/core';

export const run = async (stage?: 'pre' | 'main' | 'post'): Promise<void> => {
  console.log('!!! process.env', JSON.stringify(process.env));
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
    debug('updated state: ' + JSON.stringify(state));
  } catch (e) {
    debug(`Error: ${e}`);
    state.failed = true;

    if (!(e instanceof Error)) {
      throw e;
    }

    if (!state.shortMessage && e.message) {
      state.shortMessage = e.message;
    }
  } finally {
    if (state.failed) {
      action.updateDeployment(state, 'failure');
      state.shortMessage = undefined;
    }

    setOutput('stage', state.stage);
    setOutput('deployed', state.action === 'deploy');
    setOutput('destroyed', state.action === 'destroy');

    if (state.httpApiUrl) {
      setOutput('httpApiUrl', state.httpApiUrl);
    }

    if (stage === 'post' && state.longMessage) {
      summary.addRaw(state.longMessage, true);
      await summary.write({ overwrite: true });
      state.longMessage = undefined;
    }

    saveState('state', JSON.stringify(state));

    if (stage !== 'post' && state.failed) {
      process.exit(1);
    }
  }
};
