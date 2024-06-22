import { APIGatewayProxyResult } from 'aws-lambda';
import { ChildProcess } from 'child_process';
import { WebsocketProxy } from './websocket';

export type SpawnResult = {
  childProcess?: ChildProcess;
  bin?: string;
  endpoint?: URL;
};

export type RuntimeEvent = {
  requestId: string;
  event: string;
  deadline: number;
};

export type EndpointExecRequest = {
  requestId: string;
  bin: string;
  event: string;
  deadline: number;
};

export type EndpointProxyRequest = {
  requestId: string;
  endpoint: URL;
  event: string;
  deadline: number;
  wsProxy?: WebsocketProxy;
};

export type EndpointResponse = {
  requestId: string;
  // TODO: support results to different invokers
  payload: APIGatewayProxyResult;
};
