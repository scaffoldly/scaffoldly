export class NotFoundException extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.cause = cause;
    this.name = 'NotFoundException';
  }
}

export class SkipAction extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkipAction';
  }
}
