import { APIGatewayProxyEventQueryStringParameters, APIGatewayProxyEventV2 } from 'aws-lambda';
import { HttpServer } from '../../http/http-server';
import { LambdaRuntimeServer } from './lambda-runtime-server';
import { v4 as uniqueId } from 'uuid';
import { format } from 'date-fns';
import { Request } from 'express';
import { first } from 'rxjs';
import qs from 'qs';
import { GitService } from '../../../cd/git';

type ApiGatewayHaders = {
  [header: string]: string;
};

// Ref: https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-known-issues.html
export const REMAP_RESPONSE_HEADERS = [
  'Authorization',
  'Connection',
  'Content-MD5',
  'Date',
  'Max-Forwards',
  'Server',
  'User-Agent',
  'WWW-Authenticate',
];

export const DROP_RESPONSE_HEADERS = [
  'Expect',
  'Host',
  'Proxy-Authenticate',
  'TE',
  'Transfer-Encoding',
  'Trailer',
  'Upgrade',
  'Via',
];

export const convertHeaders = (
  headers?: Record<string, unknown>,
  requestId?: string,
): ApiGatewayHaders => {
  const converted: ApiGatewayHaders = {};

  if (requestId) {
    converted['x-amzn-requestid'] = requestId;
  }

  if (!headers) {
    return converted;
  }

  return Object.keys(headers).reduce((acc, key) => {
    const value = headers[key];

    if (!value) {
      return acc;
    }

    const newKey = key.toLowerCase();
    let newValue: string | undefined = undefined;

    if (Array.isArray(value)) {
      newValue = value.join(', ');
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      newValue = `${value}`;
    }

    if (!newValue) {
      return acc;
    }

    if (!requestId) {
      acc[newKey] = newValue;
      return acc;
    }

    // If requestId is set, we are converting response headers
    if (DROP_RESPONSE_HEADERS.includes(newKey)) {
      return acc;
    }

    if (REMAP_RESPONSE_HEADERS.includes(newKey)) {
      acc[`X-Amzn-Remapped-${newKey}`] = newValue;
      return acc;
    }

    return acc;
  }, converted as ApiGatewayHaders);
};

export const convertQueryString = (request: Request): APIGatewayProxyEventQueryStringParameters => {
  return Object.keys(request.query).reduce((acc, key) => {
    const value = request.query[key];

    if (Array.isArray(value)) {
      acc[key] = value.join(',');
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      acc[key] = value;
    }

    return acc;
  }, {} as APIGatewayProxyEventQueryStringParameters);
};

export const convertBody = (request: Request): string | undefined => {
  if (!request.body) {
    return undefined;
  }
  return Buffer.from(request.body).toString('base64');
};

const convertSourceIp = (req: Request): string => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.toString().split(',')[0];
  }

  const sourceIp = req.socket.remoteAddress;
  if (sourceIp) {
    return sourceIp;
  }

  return '127.0.0.1';
};

const convertUserAgent = (req: Request): string => {
  const userAgent = req.headers['user-agent'];
  if (userAgent) {
    return userAgent.toString();
  }

  return 'unknown/0.0.0';
};

const convertHost = (req: Request): string => {
  const host = req.headers.host;
  if (host) {
    return host;
  }

  return 'localhost';
};

export class FunctionUrlServer extends HttpServer {
  // TODO: do better
  apiId = 'abcdefghijklmnopqrstuvwxyz0123456789';

  constructor(private gitService: GitService, private lambdaRuntimeServer: LambdaRuntimeServer) {
    super('Function URL', 3000, lambdaRuntimeServer.abortController);
  }

  async registerHandlers(): Promise<void> {
    this.app.use((req, res) => {
      req.setTimeout(this.gitService.config.timeout * 1000);
      const now = new Date();
      const event: APIGatewayProxyEventV2 = {
        version: '2.0',
        routeKey: '$default',
        rawPath: req.path,
        rawQueryString: qs.stringify(req.query),
        headers: convertHeaders(req.headers),
        queryStringParameters: convertQueryString(req),
        requestContext: {
          // TODO: Account ID
          accountId: 'anonymous',
          // TODO: Github Codepsaces Hostname parsing
          apiId: this.apiId,
          domainName: `${this.apiId}.${convertHost(req)}`,
          domainPrefix: this.apiId,
          http: {
            method: req.method,
            path: req.path,
            protocol: req.protocol,
            sourceIp: convertSourceIp(req),
            userAgent: convertUserAgent(req),
          },
          requestId: uniqueId(),
          routeKey: '$default',
          stage: '$default',
          time: format(now, "dd/MMM/yyyy:HH:mm:ss '+0000'"),
          timeEpoch: now.getTime(),
        },
        body: convertBody(req),
        isBase64Encoded: true,
      };

      // TODO: Timeouts
      //       - It appears that Function URLs allow "timeout / 2" for the Buffered requests?
      // TODO: Switch to streaming Function URLs?
      // TODO: Print "Internal Server Error"
      // TODO: Cookies: https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html#urls-payloads

      this.lambdaRuntimeServer
        .emit(event)
        .pipe(first())
        .subscribe((response) => {
          if (response && response.statusCode) {
            res.status(response.statusCode);
          }
          if (response && response.headers) {
            res.header(response.headers);
          }
          if (response && response.body) {
            if (response.isBase64Encoded) {
              res.send(Buffer.from(response.body, 'base64'));
            } else {
              res.send(response.body);
            }
          }
        });
    });
  }
}
