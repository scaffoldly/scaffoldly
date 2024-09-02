import { DeployStatus } from '../scaffoldly/commands/cd/aws';

export type Status = DeployStatus & {
  failed?: boolean;
  commitSha?: string;
  deployLogsUrl?: string;
  shortMessage?: string;
  longMessage?: string;
  owner?: string;
  repo?: string;
};
