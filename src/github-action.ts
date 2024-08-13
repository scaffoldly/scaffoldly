import { Action } from './github-action/action';
import { State } from './github-action/state';
import { setFailed, saveState, debug } from '@actions/core';

console.log('!!! process env', JSON.stringify(process.env));
console.log('!!! process.argv', JSON.stringify(process.argv));

export const run = async (): Promise<void> => {
  const action = new Action();

  let state: State = {};

  try {
    state = await action.pre(state);
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
