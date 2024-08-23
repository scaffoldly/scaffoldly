import * as protobuf from 'protobufjs';

const root = protobuf.Root.fromJSON({
  nested: {
    moby: {
      nested: {
        buildkit: {
          nested: {
            trace: {
              fields: {
                hash: {
                  type: 'string',
                  id: 1,
                },
                command: {
                  type: 'bytes',
                  id: 2,
                },
                code: {
                  type: 'int32',
                  id: 3,
                },
                message: {
                  type: 'string',
                  id: 4,
                },
              },
            },
          },
        },
      },
    },
  },
});

const trace = root.lookupType('moby.buildkit.trace');

export type Trace = {
  hash?: string;
  command?: string;
  code?: number;
  message?: string;
};

export const decodeTrace = (str: string): Partial<Trace> | undefined => {
  try {
    const bytes = Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
    const message = trace.decode(bytes);
    const obj = trace.toObject(message, {
      longs: String,
      enums: String,
      bytes: String,
    }) as Partial<Trace>;
    return obj;
  } catch (e) {
    // console.warn('Failed to decode trace', e);
    return undefined;
  }
};
