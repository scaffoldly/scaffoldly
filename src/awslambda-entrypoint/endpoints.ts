// eslint-disable-next-line import/named
import axios, { AxiosResponse, AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios';
import net from 'net';
import { EndpointProxyRequest, EndpointResponse } from './types';
import { log } from './log';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Commands, Routes } from '../config';
import { pathToRegexp } from 'path-to-regexp';
import { spawnAsync } from './spawn';
import packageJson from '../../package.json';

function convertHeaders(
  headers: RawAxiosResponseHeaders | AxiosResponseHeaders,
): { [header: string]: boolean | number | string } | undefined {
  if (!headers) {
    return undefined;
  }

  return Object.keys(headers).reduce((acc, key) => {
    const value = headers[key];

    if (!value) return acc;

    if (Array.isArray(value)) {
      acc[key] = value.join(', ');
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      acc[key] = value;
    }

    return acc;
  }, {} as { [header: string]: boolean | number | string });
}

const waitForEndpoint = async (
  handler: string,
  deadline: number,
): Promise<{ endpoint: URL; timeout: number }> => {
  const start = Date.now();
  const timeout = deadline - start;
  // TODO: support different protocols
  const endpoint = new URL(`http://${handler}`);

  // Stop recursing if the deadline has passed
  if (timeout < 0) {
    return { endpoint, timeout: 0 };
  }

  const hostname = endpoint.hostname;
  const port = parseInt(endpoint.port, 10) || (endpoint.protocol === 'https:' ? 443 : 80);

  return new Promise((resolve) => {
    const socket = new net.Socket();

    const onError = () => {
      socket.destroy();
      return waitForEndpoint(handler, deadline - (Date.now() - start)).then(resolve);
    };

    socket.setTimeout(deadline - start);
    socket.once('error', onError);
    socket.once('timeout', onError);

    socket.connect(port, hostname, () => {
      socket.end();
      resolve({ endpoint, timeout: deadline - Date.now() });
    });
  });
};

export const findHandler = (routes: Routes, rawPath?: string): string | undefined => {
  if (!rawPath) {
    return undefined;
  }

  const found = Object.entries(routes).find(([path, handler]) => {
    if (!handler) {
      return false;
    }

    try {
      return !!pathToRegexp(path).exec(rawPath);
    } catch (e) {
      throw new Error(`Invalid route path regex: ${path}`);
    }
  });

  if (!found || !found[1]) {
    return undefined;
  }

  return found[1];
};

export const endpointProxy = async ({
  requestId,
  routes,
  env,
  event,
  deadline,
}: EndpointProxyRequest): Promise<EndpointResponse> => {
  // TDOO: fix event type for Function URL type
  const rawEvent = JSON.parse(event) as Partial<APIGatewayProxyEventV2 | string>;
  if (typeof rawEvent === 'string' && rawEvent.startsWith(`${packageJson.name}@`)) {
    let commands = Commands.decode(rawEvent, true);

    log('Received scheduled event', { commands });

    commands = await Promise.all(
      commands.map(async (command) => {
        try {
          const spawn = await spawnAsync(command, env, command.schedule);
          if (!spawn) {
            return command;
          }
          command.output = spawn.output?.toString('utf-8');
          return command;
        } catch (e) {
          log('Error handling scheduled command', e);
          return command;
        }
      }),
    );

    // TODO: Retries?
    return {
      requestId,
      payload: {
        statusCode: 200,
        headers: {},
        body: JSON.stringify(commands),
        isBase64Encoded: false,
      },
    };
  }

  if (typeof rawEvent !== 'object' || !('requestContext' in rawEvent)) {
    throw new Error(`Unsupported event: ${JSON.stringify(rawEvent)}`);
  }

  const {
    requestContext,
    rawPath,
    rawQueryString,
    headers: rawHeaders,
    body: rawBody,
    isBase64Encoded,
  } = rawEvent;

  if (!requestContext) {
    throw new Error('No request context found in event');
  }

  const method = requestContext.http.method;

  const handler = findHandler(routes, rawPath);

  if (!handler) {
    throw new Error(`No handler found for ${rawPath} in routes ${JSON.stringify(routes)}`);
  }

  log('Waiting for endpoint', { handler, routes, deadline });
  const { endpoint, timeout } = await waitForEndpoint(handler, deadline);

  if (!timeout) {
    throw new Error(`${handler} took longer than ${timeout} milliseconds to start.`);
  }

  if (!rawPath) {
    throw new Error('No path found in event');
  }

  const url = new URL(rawPath, endpoint);
  if (rawQueryString) {
    url.search = new URLSearchParams(rawQueryString).toString();
  }

  const decodedBody = isBase64Encoded && rawBody ? Buffer.from(rawBody, 'base64') : rawBody;

  log('Proxying request', { url, method, rawHeaders, timeout });

  let response: AxiosResponse<unknown, unknown> | undefined = undefined;

  response = await axios.request({
    method: method.toLowerCase(),
    url: url.toString(),
    headers: rawHeaders,
    data: decodedBody,
    timeout,
    transformRequest: (data) => data,
    transformResponse: (data) => data,
    validateStatus: () => true,
    responseType: 'arraybuffer',
  });

  if (!response) {
    throw new Error('No response received');
  }

  const { data: rawData, headers: rawResponseHeaders } = response;

  if (!Buffer.isBuffer(rawData)) {
    throw new Error('Response data is not a buffer');
  }

  log('Proxy request complete', { url, method, rawResponseHeaders });

  return {
    requestId,
    payload: {
      statusCode: response.status,
      headers: convertHeaders(rawResponseHeaders),
      body: Buffer.from(rawData).toString('base64'),
      isBase64Encoded: true,
    },
  };
};
