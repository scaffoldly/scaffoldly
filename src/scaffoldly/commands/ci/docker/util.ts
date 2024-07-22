import { Writable, WritableOptions } from 'stream';

export class BufferedWriteStream extends Writable {
  private buffer: Buffer;

  constructor(options?: WritableOptions) {
    super(options);
    this.buffer = Buffer.alloc(0);
  }

  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    callback();
  }

  getString(): string {
    return this.buffer.toString();
  }
}
