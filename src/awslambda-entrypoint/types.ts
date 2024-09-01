import { ChildProcess } from 'child_process';
import { Commands, Routes } from '../config';
import { AsyncSubject } from 'rxjs';

export type SpawnResult = {
  childProcess?: ChildProcess;
  handler: string;
};

export type AsyncPayload = {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
  isBase64Encoded: boolean;
};

export type AsyncResponse = {
  requestId?: string;
  payload: AsyncPayload;
};

export type EndpointProxyRequest = {
  requestId: string;
  routes: Routes;
  commands: Commands;
  env: Record<string, string>;
  event: string;
  deadline: number;
};

export type RuntimeEvent = {
  requestId: string;
  event: string;
  deadline: number;
  response$: AsyncSubject<AsyncResponse>;
};

export type RuntimeEventWithPath = RuntimeEvent & {
  path: string;
};
