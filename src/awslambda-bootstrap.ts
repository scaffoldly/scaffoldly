#!/usr/bin/env node

import { pollForEvents } from './awslambda-bootstrap/events';
import { endpointSpawn, endpointProxy } from './awslambda-bootstrap/endpoints';
import { log } from './awslambda-bootstrap/log';
import { getRuntimeEvent, postRuntimeEventResponse } from './awslambda-bootstrap/runtime';
import { RuntimeEvent, EndpointProxyRequest, EndpointResponse } from './awslambda-bootstrap/types';
import packageJson from '../package.json';
import { decode } from './config';

const { CONFIG, AWS_LAMBDA_RUNTIME_API } = process.env;

export const run = async (): Promise<void> => {
  if (process.argv.includes('--version')) {
    console.log(packageJson.version);
    return;
  }

  if (!AWS_LAMBDA_RUNTIME_API) {
    throw new Error('No AWS_LAMBDA_RUNTIME_API specified');
  }

  if (!CONFIG) {
    throw new Error('No config specified');
  }

  log('Bootstraping', { CONFIG, AWS_LAMBDA_RUNTIME_API });

  const config = decode(CONFIG);

  const { handler } = config;

  if (!handler) {
    throw new Error('No handler found in config');
  }

  log('Polling for events', { config });
  await pollForEvents(AWS_LAMBDA_RUNTIME_API, handler);
};

export {
  endpointSpawn,
  endpointProxy,
  getRuntimeEvent,
  postRuntimeEventResponse,
  RuntimeEvent,
  EndpointProxyRequest,
  EndpointResponse,
};

if (require.main === module) {
  (async () => {
    try {
      await run();
    } catch (e) {
      console.error(e);
      process.exit(-1);
    }
  })();
}
