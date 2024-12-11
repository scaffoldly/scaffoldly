import { pathToRegexp } from 'path-to-regexp';
import binarySplit from 'binary-split';
import { Routes } from '../config';
import { ALBEventQueryStringParameters } from 'aws-lambda';
import {
  // eslint-disable-next-line import/named
  AxiosResponseHeaders,
  // eslint-disable-next-line import/named
  RawAxiosResponseHeaders,
} from 'axios';
import { AsyncPrelude } from './types';
import { Readable } from 'stream';

export const fromResponseStream = (
  stream: Readable,
): Promise<{ prelude: AsyncPrelude; payload: Readable }> => {
  const delimiter = Buffer.alloc(8); // 8-byte delimiter (all zeros)

  return new Promise((resolve, reject) => {
    const parts = stream.pipe(binarySplit(delimiter));
    let prelude: AsyncPrelude | undefined;

    const handleEnd = () => {
      if (!prelude) {
        reject(new Error('Stream ended before a valid prelude was received'));
      }
    };

    const handleError = (err: Error) => {
      reject(err);
    };

    parts.on('data', (chunk: Buffer) => {
      if (!prelude) {
        try {
          prelude = JSON.parse(chunk.toString('utf8')) as AsyncPrelude;
          resolve({ prelude, payload: new Readable().wrap(parts) });
        } catch (err) {
          reject(new Error(`Failed to parse prelude: ${err.message}`));
        } finally {
          parts.off('end', handleEnd);
          parts.off('error', handleError);
        }
      }
    });

    parts.once('end', handleEnd);
    parts.once('error', handleError);
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
