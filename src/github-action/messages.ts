import ejs, { Options } from 'ejs';
import roleSetupMd from './templates/roleSetup.md';
import deployedCommentMd from './templates/deployedComment.md';
import failedCommentMd from './templates/failedComment.md';
import { State } from './state';

const ejsOptions: Options = { openDelimiter: '{', closeDelimiter: '}' };

export type Message = {
  longMessage: string;
  shortMessage: string;
};

export const roleSetupMoreInfo = async (
  owner: string,
  repo: string,
  state: State,
): Promise<string> => {
  return ejs.render(roleSetupMd, { owner, repo, state }, ejsOptions);
};

export const deployedMarkdown = async (state: State): Promise<Message> => {
  const long = await ejs.render(deployedCommentMd, { state }, ejsOptions);
  const short = `Successfully deployed branch ${state.deployStatus?.branch}`;
  return { longMessage: long, shortMessage: short };
};

export const failedMarkdown = async (state: State, moreInfo?: string): Promise<Message> => {
  const long = await ejs.render(failedCommentMd, { state, moreInfo }, ejsOptions);
  const short = state.shortMessage || `Failed to deploy branch ${state.deployStatus?.branch}`;
  return { longMessage: long, shortMessage: short };
};
