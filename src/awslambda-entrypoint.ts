#!/usr/bin/env node

import { pollForEvents } from './awslambda-entrypoint/events';
import { endpointProxy } from './awslambda-entrypoint/endpoints';
import { log } from './awslambda-entrypoint/log';
import { getRuntimeEvent, postRuntimeEventResponse } from './awslambda-entrypoint/runtime';
import { RuntimeEvent, EndpointProxyRequest, EndpointResponse } from './awslambda-entrypoint/types';
import packageJson from '../package.json';
import { Routes } from './config';

const { SLY_ROUTES, AWS_LAMBDA_RUNTIME_API } = process.env;

export const run = async (): Promise<void> => {
  if (process.argv.includes('--version')) {
    console.log(packageJson.version);
    return;
  }

  if (!AWS_LAMBDA_RUNTIME_API) {
    throw new Error('No AWS_LAMBDA_RUNTIME_API specified');
  }

  if (!SLY_ROUTES) {
    throw new Error('No SLY_CONFIG specified');
  }

  log('Bootstraping', { SLY_ROUTES, AWS_LAMBDA_RUNTIME_API });

  let routes: Routes | undefined = undefined;

  try {
    routes = JSON.parse(SLY_ROUTES);
  } catch (e) {
    throw new Error('Unable to parse SLY_ROUTES');
  }

  if (!routes) {
    throw new Error('No routes found');
  }

  log('Polling for events', { routes });
  await pollForEvents(AWS_LAMBDA_RUNTIME_API, routes);
};

export {
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
