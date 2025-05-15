#!/usr/bin/env node
import { info, isDebug, log } from './awslambda-entrypoint/log';
import { poll } from './awslambda-entrypoint/observables';
import { AbortEvent } from './awslambda-entrypoint/types';
import { Routes, Commands, decode } from './config';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { execa } from 'execa';

const { SLY_SERVE, SLY_ROUTES, SLY_SECRET, AWS_LAMBDA_RUNTIME_API } = process.env;

export const run = async (abortEvent: AbortEvent): Promise<void> => {
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
        log(`Secrets fetched`, { SLY_SECRET, entries: Object.keys(obj) });

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
    routes = decode(SLY_ROUTES);
  } catch (e) {
    throw new Error('Unable to parse SLY_ROUTES', { cause: e });
  }

  if (!routes || !Object.keys(routes).length) {
    throw new Error('No routes defined');
  }

  // Append "&" to run in background
  // TODO: Turn these (and secret fetching) into Lambda Extensions
  // TODO: This should probably iterator over the commands and run them in parallel
  const { exe, args, shell, stdio } = commands.parse({});

  const proc = execa(exe, args, {
    shell: shell,
    detached: true,
    stdin: stdio.stdin,
    stdout: stdio.stdout,
    stderr: process.stdout,
    env: { ...process.env, ...env },
    verbose: isDebug,
    signal: abortEvent.signal,
  });

  proc.unref();

  info('Polling for events', { routes });

  await poll(abortEvent, AWS_LAMBDA_RUNTIME_API, routes, env, stdio);

  info('Exiting!');
};

if (require.main === module) {
  const abortEvent = new AbortEvent();
  run(abortEvent)
    .then(() => {})
    .catch((e) => {
      abortEvent.abort(e);
    });
}
