import { pollForEvents } from './awslambda-bootstrap/events';
import { endpointSpawn, endpointProxy } from './awslambda-bootstrap/endpoints';
import { log } from './awslambda-bootstrap/log';
import { getRuntimeEvent, postRuntimeEventResponse } from './awslambda-bootstrap/runtime';
import {
  RuntimeEvent,
  EndpointExecRequest,
  EndpointProxyRequest,
  EndpointResponse,
} from './awslambda-bootstrap/types';
import { WebsocketProxy } from './awslambda-bootstrap/websocket';
import packageJson from '../package.json';

const { _HANDLER, AWS_LAMBDA_RUNTIME_API, _WEBSOCKET_ROUTE } = process.env;

export const run = async (): Promise<void> => {
  if (process.argv.includes('--version')) {
    console.log(packageJson.version);
    return;
  }

  if (!AWS_LAMBDA_RUNTIME_API) {
    throw new Error('No AWS_LAMBDA_RUNTIME_API specified');
  }

  if (!_HANDLER) {
    throw new Error('No handler specified');
  }

  log('Bootstraping', { _HANDLER, AWS_LAMBDA_RUNTIME_API, _WEBSOCKET_ROUTE });

  const { childProcess, bin, endpoint } = await endpointSpawn(_HANDLER, process.env);

  const websocketProxy = new WebsocketProxy(endpoint, _WEBSOCKET_ROUTE);

  try {
    log('Polling for events', { bin, endpoint });
    await pollForEvents(AWS_LAMBDA_RUNTIME_API, bin, endpoint, websocketProxy);
  } catch (e) {
    if (childProcess) {
      log('Killing child process', { pid: childProcess.pid });
      childProcess.kill();
    }
    throw e;
  }
};

export {
  endpointSpawn,
  endpointProxy,
  getRuntimeEvent,
  postRuntimeEventResponse,
  RuntimeEvent,
  EndpointExecRequest,
  EndpointProxyRequest,
  EndpointResponse,
};
