import { pathToRegexp } from 'path-to-regexp';
import binarySplit from 'binary-split';
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

export const RESPONSE_STREAM_HEADERS = {
  'Transfer-Encoding': 'chunked',
  'Lambda-Runtime-Function-Response-Mode': 'streaming',
  'Content-Type': 'application/vnd.awslambda.http-integration-response',
  Trailer: ['Lambda-Runtime-Function-Error-Type', 'Lambda-Runtime-Function-Error-Body'],
};

export const intoResponseStream = (prelude: AsyncPrelude, payload: Readable): Readable => {
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

export const fromResponseStream = (
  stream: Readable,
): Promise<{ prelude: AsyncPrelude; payload: Readable }> => {
  const delimiter = Buffer.alloc(8); // 8-byte delimiter (all zeros)

  return new Promise((resolve, reject) => {
    const parts = stream.pipe(binarySplit(delimiter));
    let prelude: AsyncPrelude | undefined;

    parts.on('data', (chunk: Buffer) => {
      if (!prelude) {
        prelude = JSON.parse(chunk.toString('utf8')) as AsyncPrelude;
        resolve({ prelude, payload: new Readable().wrap(parts) });
      }
    });

    parts.on('error', reject);
  });
};

export const intoResponseStreamOptions = (
  abortEvent: AbortEvent,
  requestId?: string,
): AxiosRequestConfig<Readable> => {
  return {
    headers: RESPONSE_STREAM_HEADERS,
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

export const transformAxiosResponseCookies = (
  headers: RawAxiosResponseHeaders | AxiosResponseHeaders,
): string[] => {
  const cookies = headers['set-cookie'] || [];
  return cookies;
};
