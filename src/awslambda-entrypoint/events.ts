import { error, log } from './log';
import { EndpointProxyRequest } from './types';
import { endpointProxy } from './endpoints';
import { getRuntimeEvent, postRuntimeEventResponse } from './runtime';
import { Commands, Routes } from '../config';
import { APIGatewayProxyResult } from 'aws-lambda';

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

  let payload: APIGatewayProxyResult | undefined = undefined;
  try {
    payload = (await endpointProxy(request)).payload;
  } catch (e) {
    if (!(e instanceof Error)) {
      throw new Error('Unknown error', { cause: e });
    }

    error(`Error processing request: ${e.message}`);

    payload = {
      statusCode: 502,
      headers: {
        // TODO: infer content type from request
        // TODO: create a custom error type to do this
        // TODO: CORS?
        'Content-Type': 'application/json',
      },
      body: 'Internal Server Error',
      isBase64Encoded: false,
    };
  }

  await postRuntimeEventResponse(runtimeApi, requestId, payload);
  log('Response sent to Lambda Runtime API', { runtimeApi, requestId });

  return pollForEvents(runtimeApi, routes, commands, env);
};
