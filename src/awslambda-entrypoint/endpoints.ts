// eslint-disable-next-line import/named
import axios, { AxiosResponse, AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios';
import net from 'net';
import { EndpointProxyRequest, EndpointResponse } from './types';
import { isDebug, log } from './log';
import { ALBEvent, ALBEventQueryStringParameters, APIGatewayProxyEventV2 } from 'aws-lambda';
import { Commands, CONFIG_SIGNATURE, Routes } from '../config';
import { pathToRegexp } from 'path-to-regexp';
import { execa } from 'execa';

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

function convertToURLSearchParams(
  params: ALBEventQueryStringParameters | undefined,
): URLSearchParams {
  // Initialize URLSearchParams
  const searchParams = new URLSearchParams();

  // Check if params is not undefined
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      // Only append keys with defined values
      if (value !== undefined) {
        searchParams.append(key, value);
      }
    }
  }

  return searchParams;
}

const waitForEndpoint = async (handler: string, deadline: number): Promise<{ endpoint?: URL }> => {
  const now = Date.now();
  if (now > deadline) {
    // Stop recursing if the deadline has passed
    return { endpoint: undefined };
  }

  // TODO: support different protocols
  const endpoint = new URL(`http://${handler}`);

  const hostname = endpoint.hostname;
  const port = parseInt(endpoint.port, 10) || (endpoint.protocol === 'https:' ? 443 : 80);

  return new Promise((resolve) => {
    const socket = new net.Socket();

    const onError = () => {
      socket.destroy();
      return waitForEndpoint(handler, deadline).then(resolve);
    };

    socket.setTimeout(deadline - now);
    socket.once('error', onError);
    socket.once('timeout', onError);

    socket.connect(port, hostname, () => {
      socket.end();
      resolve({ endpoint });
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
  const rawEvent = JSON.parse(event) as Partial<APIGatewayProxyEventV2 | ALBEvent | string>;
  deadline = deadline - 1000; // Subtract 1 second to allow errors to propagate

  log('Received event', { rawEvent });

  if (typeof rawEvent === 'string' && rawEvent.startsWith(`${CONFIG_SIGNATURE}@`)) {
    const commands = Commands.decode(rawEvent);
    log('Received scheduled event', { commands });

    try {
      const foo = await execa(commands.toString(), {
        shell: true,
        env: { ...process.env, ...env },
        verbose: isDebug,
        all: true, // Capture stdout and stderr into "all"
      });

      return {
        requestId,
        payload: {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(foo.all),
          isBase64Encoded: false,
        },
      };
    } catch (error) {
      log('Error executing command', { error });
      return {
        requestId,
        payload: {
          statusCode: 500,
          headers: {},
          body: JSON.stringify(error.all),
          isBase64Encoded: false,
        },
      };
    }

    // TODO: Retries?
  }

  if (typeof rawEvent !== 'object' || !('requestContext' in rawEvent)) {
    throw new Error(`Unsupported event: ${JSON.stringify(rawEvent)}`);
  }

  const { requestContext, headers: rawHeaders, body: rawBody, isBase64Encoded } = rawEvent;

  if (!requestContext) {
    throw new Error('No request context found in event');
  }

  let method: string | undefined = undefined;
  if ('http' in requestContext) {
    method = requestContext.http.method;
  }
  if ('elb' in requestContext && 'httpMethod' in rawEvent) {
    method = rawEvent.httpMethod;
  }
  if (!method) {
    throw new Error('No method found in event');
  }

  let rawPath: string | undefined = undefined;
  if ('http' in requestContext) {
    rawPath = requestContext.http.path;
  }
  if ('elb' in requestContext && 'path' in rawEvent) {
    rawPath = rawEvent.path;
  }
  if (!rawPath) {
    throw new Error('No path found in event');
  }

  let urlSearchParams: URLSearchParams | undefined = undefined;
  if ('http' in requestContext && 'rawQueryString' in rawEvent) {
    urlSearchParams = new URLSearchParams(rawEvent.rawQueryString);
  }
  if ('elb' in requestContext && 'queryStringParameters' in rawEvent) {
    urlSearchParams = convertToURLSearchParams(rawEvent.queryStringParameters);
  }

  const handler = findHandler(routes, rawPath);

  if (!handler) {
    throw new Error(`No handler found for ${rawPath} in routes ${JSON.stringify(routes)}`);
  }

  log('Waiting for endpoint', { handler, routes, deadline });
  const { endpoint } = await waitForEndpoint(handler, deadline);

  if (!endpoint) {
    throw new Error(`${handler} did not start before ${new Date(deadline).toISOString()}.`);
  }

  const url = new URL(rawPath, endpoint);
  if (urlSearchParams) {
    url.search = urlSearchParams.toString();
  }

  const decodedBody = isBase64Encoded && rawBody ? Buffer.from(rawBody, 'base64') : rawBody;
  const timeout = deadline - Date.now();

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
