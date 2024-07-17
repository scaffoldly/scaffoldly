#!/usr/bin/env node

import { pollForEvents } from './awslambda-entrypoint/events';
import { endpointProxy } from './awslambda-entrypoint/endpoints';
import { log } from './awslambda-entrypoint/log';
import { getRuntimeEvent, postRuntimeEventResponse } from './awslambda-entrypoint/runtime';
import { RuntimeEvent, EndpointProxyRequest, EndpointResponse } from './awslambda-entrypoint/types';
import packageJson from '../package.json';
import { Routes, ServeCommand, ServeCommands } from './config';
import { spawn } from 'child_process';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const { SLY_SERVE, SLY_ROUTES, SLY_SECRET, AWS_LAMBDA_RUNTIME_API } = process.env;

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

  log('Bootstraping', { SLY_SERVE, SLY_ROUTES, SLY_SECRET, AWS_LAMBDA_RUNTIME_API });

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

  let serveCommands: ServeCommand[];
  let routes: Routes;

  try {
    serveCommands = ServeCommands.decode(SLY_SERVE);
  } catch (e) {
    throw new Error('Unable to parse SLY_ROUTES');
  }

  if (!serveCommands || !serveCommands.length) {
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

  const procs = serveCommands.map(({ cmd, workdir }) => {
    const [command, ...args] = cmd.split(' ');
    const proc = spawn(command, args, {
      detached: true,
      stdio: 'inherit',
      cwd: workdir,
      env: { ...process.env, ...env },
    });
    proc.on('exit', (code) => {
      log('Process exited', { cmd });
      if (code !== 0) {
        throw new Error(`${cmd} exited with code ${code}`);
      }
    });
    return proc;
  });

  log('Processes spawned', { pids: procs.map((p) => p.pid) });

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
