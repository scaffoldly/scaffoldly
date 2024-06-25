import axios, { AxiosResponse, AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios';
import net from 'net';
import { EndpointProxyRequest, EndpointResponse, SpawnResult } from './types';
import { info, log } from './log';
import { ChildProcess, spawn } from 'child_process';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ScaffoldlyConfig } from 'src/config';

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

export const endpointSpawn = async (
  config: ScaffoldlyConfig,
  env?: NodeJS.ProcessEnv,
): Promise<SpawnResult> => {
  let childProcess: ChildProcess | undefined = undefined;

  const { scripts, handler = process.env._HANDLER } = config;
  if (!handler) {
    throw new Error('No handler found in config');
  }

  const { start: bin } = scripts || {};
  if (!bin) {
    throw new Error('No start script found in config');
  }

  info(`Running: \`${bin}\``);

  const cmds = bin.split(' ');
  childProcess = spawn(cmds[0], cmds.slice(1), {
    detached: true,
    stdio: 'inherit',
    env: env,
  });

  log('Started child process', { cmds, pid: childProcess.pid });

  return {
    childProcess,
    handler,
  };
};

export const endpointProxy = async ({
  requestId,
  handler,
  event,
  deadline,
}: EndpointProxyRequest): Promise<EndpointResponse> => {
  // TDOO: fix event type
  const rawEvent = JSON.parse(event) as Partial<APIGatewayProxyEventV2>;

  log('!!! Received event', { requestId, rawEvent: JSON.stringify(rawEvent) });

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

  log('Waiting for endpoint to start', { handler, deadline });
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

  let response: AxiosResponse<any, any> | undefined = undefined;

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
