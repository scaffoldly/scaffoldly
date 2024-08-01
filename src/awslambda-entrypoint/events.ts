import { log } from './log';
import { EndpointProxyRequest } from './types';
import { endpointProxy } from './endpoints';
import { getRuntimeEvent, postRuntimeEventResponse } from './runtime';
import { Commands, Routes } from '../config';

export const pollForEvents = async (
  runtimeApi: string,
  routes: Routes,
  commands: Commands,
  env: Record<string, string>,
): Promise<void> => {
  log('Waiting for next event from Lambda Runtime API', { runtimeApi });

  const { requestId, event, deadline } = await getRuntimeEvent(runtimeApi);

  log('Proxying request', { routes, commands });

  const request: EndpointProxyRequest = {
    requestId,
    routes,
    commands,
    env,
    event,
    deadline,
  };

  const payload = (await endpointProxy(request)).payload;
  await postRuntimeEventResponse(runtimeApi, requestId, payload);

  log('Response sent to Lambda Runtime API', { runtimeApi, requestId });

  return pollForEvents(runtimeApi, routes, commands, env);
};
