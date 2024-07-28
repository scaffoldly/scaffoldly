#!/usr/bin/env node

import { pollForEvents } from './awslambda-entrypoint/events';
import { endpointProxy } from './awslambda-entrypoint/endpoints';
import { log } from './awslambda-entrypoint/log';
import { getRuntimeEvent, postRuntimeEventResponse } from './awslambda-entrypoint/runtime';
import { RuntimeEvent, EndpointProxyRequest, EndpointResponse } from './awslambda-entrypoint/types';
import packageJson from '../package.json';
import { Routes, Command, Commands } from './config';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { spawnAsync } from './awslambda-entrypoint/spawn';

const { SLY_STRICT, SLY_SERVE, SLY_ROUTES, SLY_SECRET, AWS_LAMBDA_RUNTIME_API } = process.env;

export const run = async (): Promise<void> => {
  if (process.argv.includes('--version')) {
    console.log(packageJson.version);
    return;
  }

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
    SLY_STRICT,
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
        throw new Error(`Unable to fetch secret ${SLY_SECRET}: ${e.message}`, e);
      });
  }

  let commands: Command[];
  let routes: Routes;

  try {
    commands = Commands.decode(SLY_SERVE, SLY_STRICT !== 'false');
  } catch (e) {
    throw new Error('Unable to parse SLY_SERVE');
  }

  if (!commands || !commands.length) {
    throw new Error('No serve commands found');
  }

  try {
    routes = JSON.parse(SLY_ROUTES);
  } catch (e) {
    throw new Error('Unable to parse SLY_ROUTES');
  }

  if (!routes || !Object.keys(routes).length) {
    throw new Error('No routes found');
  }

  await Promise.all(
    commands
      .filter((command) => !command.schedule) // filter out scheduled commands
      .map((command) => spawnAsync(command, env)),
  );

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
