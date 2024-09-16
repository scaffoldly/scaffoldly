import ejs, { Options } from 'ejs';
import deployedCommentMd from './templates/deployedComment.md';
import failedCommentMd from './templates/failedComment.md';
import { Status } from './status';

const ejsOptions: Options = { openDelimiter: '{', closeDelimiter: '}' };

export type Message = {
  longMessage: string;
  shortMessage: string;
};

export const deployedMarkdown = async (status: Status): Promise<Message> => {
  const long = await ejs.render(deployedCommentMd, { status }, ejsOptions);
  const short = `Successfully deployed branch ${status?.branch}`;
  return { longMessage: long, shortMessage: short };
};

export const failedMarkdown = async (status: Status, moreInfo?: string): Promise<Message> => {
  const long = await ejs.render(failedCommentMd, { status, moreInfo }, ejsOptions);
  const short = status.shortMessage || `Failed to deploy branch ${status?.branch}`;
  return { longMessage: long, shortMessage: short };
};
