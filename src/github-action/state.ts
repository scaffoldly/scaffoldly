import { DeployStatus } from '../scaffoldly/commands/cd/aws';

export type State = {
  failed?: boolean;
  commitSha?: string;
  deployLogsUrl?: string;
  shortMessage?: string;
  longMessage?: string;
  deployStatus: DeployStatus;
};
