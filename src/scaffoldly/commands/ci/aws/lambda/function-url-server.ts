import {
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyEventV2,
} from 'aws-lambda';
import { HttpServer } from '../../http/http-server';
import { LambdaRuntimeServer } from './lambda-runtime-server';
import { v4 as uniqueId } from 'uuid';
import { format } from 'date-fns';
import { Request } from 'express';
import { first } from 'rxjs';
import qs from 'qs';

export const convertHeaders = (request: Request): APIGatewayProxyEventHeaders => {
  return Object.keys(request.headers).reduce((acc, key) => {
    const value = request.headers[key];

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
  }, {} as APIGatewayProxyEventHeaders);
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

  constructor(private lambdaRuntimeServer: LambdaRuntimeServer) {
    super('Function URL', 3000, lambdaRuntimeServer.abortController, { timeout: 30 });
  }

  async registerHandlers(): Promise<void> {
    // TODO: Simulate Timeout
    this.app.use((req, res) => {
      const now = new Date();
      const event: APIGatewayProxyEventV2 = {
        version: '2.0',
        routeKey: '$default',
        rawPath: req.path,
        rawQueryString: qs.stringify(req.query),
        headers: convertHeaders(req),
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
