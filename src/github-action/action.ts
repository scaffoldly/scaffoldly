import { State } from './state';

export class Action {
  async pre(state: State): Promise<State> {
    console.log('!!! in pre');
    return state;
  }

  async main(state: State): Promise<State> {
    console.log('!!! in main');
    return state;
  }

  async post(state: State): Promise<State> {
    console.log('!!! in post');
    return state;
  }
}
