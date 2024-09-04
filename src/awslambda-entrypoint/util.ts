import { pathToRegexp } from 'path-to-regexp';
import { Routes } from '../config';
import { ALBEventQueryStringParameters } from 'aws-lambda';
import {
  // eslint-disable-next-line import/named
  AxiosRequestConfig,
  // eslint-disable-next-line import/named
  AxiosResponseHeaders,
  // eslint-disable-next-line import/named
  RawAxiosResponseHeaders,
} from 'axios';
import { PassThrough, Readable } from 'stream';
import { AbortEvent, AsyncPrelude } from './types';
import { log } from './log';

export const responseStream = (prelude: AsyncPrelude, payload: Readable): Readable => {
  const stream = new PassThrough();

  // Add the application/vnd.awslambda.http-integration-response prelude
  // Ref: Similar to StreamingResponse in https://github.com/awslabs/aws-lambda-rust-runtime/blob/main/lambda-runtime/src/requests.rs
  new Readable({
    read() {
      this.push(Buffer.from(JSON.stringify(prelude))); // Write a stringified prelude
      this.push(Buffer.alloc(8)); // Write 8-byte delimiter
      this.push(null); // End the initial stream
    },
  }).pipe(stream, { end: false });

  payload.pipe(stream);

  return stream;
};

export const responseStreamOptions = (
  abortEvent: AbortEvent,
  requestId?: string,
): AxiosRequestConfig<Readable> => {
  return {
    headers: {
      'Transfer-Encoding': 'chunked',
      'Lambda-Runtime-Function-Response-Mode': 'streaming',
      'Content-Type': 'application/vnd.awslambda.http-integration-response',
      Trailer: ['Lambda-Runtime-Function-Error-Type', 'Lambda-Runtime-Function-Error-Body'],
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    onUploadProgress: (progress) => {
      log('Stream progress', { requestId, progress });
    },
    signal: abortEvent.signal,
  };
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

export function convertAlbQueryStringToURLSearchParams(
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

export const transformAxiosResponseHeaders = (
  headers: RawAxiosResponseHeaders | AxiosResponseHeaders,
): Record<string, unknown> => {
  return Object.entries(headers).reduce((acc, [key, value]) => {
    if (value) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, unknown>);
};
