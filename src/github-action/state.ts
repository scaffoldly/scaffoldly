export type State = {
  action?: 'deploy' | 'destroy';
  stage?: string;
  httpApiUrl?: string;
  deploymentId?: number;
  commentId?: number;
  failed?: boolean;
  shortMessage?: string;
  longMessage?: string;
};
