import ejs, { Options } from 'ejs';
import roleSetupMd from './templates/roleSetup.md';
import preparingCommentMd from './templates/preparingComment.md';
import deployingCommentMd from './templates/deployingComment.md';
import destroyingCommentMd from './templates/destroyingComment.md';
import deployedCommentMd from './templates/deployedComment.md';
import destroyedCommentMd from './templates/destroyedComment.md';
import failedCommentMd from './templates/failedComment.md';

const ejsOptions: Options = { openDelimiter: '{', closeDelimiter: '}' };

export type Message = {
  longMessage: string;
  shortMessage: string;
};

export const roleSetupMoreInfo = async (
  owner: string,
  repo: string,
  logsUrl: string,
): Promise<string> => {
  return ejs.render(roleSetupMd, { owner, repo, logsUrl }, ejsOptions);
};

export const preparingMarkdown = async (
  commitSha: string,
  stage: string,
  logsUrl?: string,
): Promise<Message> => {
  const long = await ejs.render(preparingCommentMd, { commitSha, stage, logsUrl }, ejsOptions);
  const short = `Preparing stage ${stage}`;
  return { longMessage: long, shortMessage: short };
};

export const deployingMarkdown = async (
  commitSha: string,
  stage: string,
  logsUrl?: string,
): Promise<Message> => {
  const long = await ejs.render(deployingCommentMd, { commitSha, stage, logsUrl }, ejsOptions);
  const short = `Deploying stage ${stage}`;
  return { longMessage: long, shortMessage: short };
};

export const destroyingMarkdown = async (
  commitSha: string,
  stage: string,
  logsUrl?: string,
): Promise<Message> => {
  const long = await ejs.render(destroyingCommentMd, { commitSha, stage, logsUrl }, ejsOptions);
  const short = `Deleting stage ${stage}`;
  return { longMessage: long, shortMessage: short };
};

export const deployedMarkdown = async (
  commitSha: string,
  stage: string,
  httpApiUrl?: string,
  logsUrl?: string,
): Promise<Message> => {
  const long = await ejs.render(
    deployedCommentMd,
    { commitSha, stage, httpApiUrl, logsUrl },
    ejsOptions,
  );
  const short = `Deployed stage ${stage} to ${httpApiUrl}`;
  return { longMessage: long, shortMessage: short };
};

export const destroyedMarkdown = async (
  commitSha: string,
  stage: string,
  logsUrl?: string,
): Promise<Message> => {
  const long = await ejs.render(destroyedCommentMd, { commitSha, stage, logsUrl }, ejsOptions);
  const short = `Deleted stage ${stage}`;
  return { longMessage: long, shortMessage: short };
};

export const failedMarkdown = async (
  commitSha: string,
  stage: string,
  logsUrl?: string,
  moreInfo?: string,
): Promise<Message> => {
  const long = await ejs.render(
    failedCommentMd,
    { commitSha, stage, logsUrl, moreInfo },
    ejsOptions,
  );
  const short = `Failed to update stage ${stage}`;
  return { longMessage: long, shortMessage: short };
};
