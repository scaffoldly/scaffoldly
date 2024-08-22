#!/usr/bin/env node

import { pollForEvents } from './awslambda-entrypoint/events';
import { endpointProxy } from './awslambda-entrypoint/endpoints';
import { isDebug, log } from './awslambda-entrypoint/log';
import { getRuntimeEvent, postRuntimeEventResponse } from './awslambda-entrypoint/runtime';
import { RuntimeEvent, EndpointProxyRequest, EndpointResponse } from './awslambda-entrypoint/types';
import { Routes, Commands } from './config';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { execa } from 'execa';

const { SLY_SERVE, SLY_ROUTES, SLY_SECRET, AWS_LAMBDA_RUNTIME_API } = process.env;

export const run = async (): Promise<void> => {
  if (!AWS_LAMBDA_RUNTIME_API) {
    throw new Error('Missing AWS_LAMBDA_RUNTIME_API');
  }

  if (!SLY_SERVE) {
    throw new Error('Missing SLY_SERVE');
  }

  if (!SLY_ROUTES) {
    throw new Error('Missing SLY_ROUTES');
  }

  log('Bootstraping', {
    SLY_SERVE,
    SLY_ROUTES,
    SLY_SECRET,
    AWS_LAMBDA_RUNTIME_API,
  });

  let env: Record<string, string> = {};

  if (SLY_SECRET) {
    const client = new SecretsManagerClient();
    env = await client
      .send(new GetSecretValueCommand({ SecretId: SLY_SECRET }))
      .then((res) => {
        if (!res.SecretBinary) {
          throw new Error('Secret does not contain binary data');
        }

        const obj = JSON.parse(Buffer.from(res.SecretBinary).toString('utf-8')) as Record<
          string,
          string
        >;
        log(`Secrets fetched`, { SLY_SECRET, entries: Object.keys(obj).length });

        return obj;
      })
      .catch((e) => {
        throw new Error(`Unable to fetch secret ${SLY_SECRET}`, { cause: e });
      });
  }

  let commands: Commands;
  let routes: Routes;

  try {
    commands = Commands.decode(SLY_SERVE);
  } catch (e) {
    throw new Error('Unable to parse SLY_SERVE', { cause: e });
  }

  try {
    routes = JSON.parse(SLY_ROUTES);
  } catch (e) {
    throw new Error('Unable to parse SLY_ROUTES', { cause: e });
  }

  if (!routes || !Object.keys(routes).length) {
    throw new Error('No routes found');
  }

  // Append "&" to run in background
  // TODO: Turn these (and secret fetching) into Lambda Extensions
  const proc = execa(`${commands.toString({})} &`, {
    shell: true,
    detached: true,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
    verbose: isDebug,
  });

  proc.unref();

  log('Polling for events', { routes });
  await pollForEvents(AWS_LAMBDA_RUNTIME_API, routes, commands, env);
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
