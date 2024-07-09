export class NotFoundException extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.cause = cause;
    this.name = 'NotFoundException';
  }
}
