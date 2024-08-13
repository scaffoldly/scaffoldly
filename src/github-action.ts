import { Action } from './github-action/action';
import { State } from './github-action/state';
import { setFailed, saveState, getState, debug } from '@actions/core';

export const run = async (stage?: 'pre' | 'main' | 'post'): Promise<void> => {
  console.log('!!! stage', stage);

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
    if (!(e instanceof Error)) {
      throw e;
    }
    debug(`${e}`);
    setFailed(e.message);
  } finally {
    if (state.failed && state.shortMessage) {
      setFailed(state.shortMessage);
      state.shortMessage = undefined;
    }

    saveState('state', JSON.stringify(state));
  }
};

if (require.main === module) {
  (async () => {
    try {
      await run();
    } catch (e) {
      console.error(e);
      process.exit(-1);
    }
  })();
}
