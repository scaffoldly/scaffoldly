export class NotFoundException extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.cause = cause;
    this.name = 'NotFoundException';
  }
}

export class FatalException extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.cause = cause;
    this.name = 'FatalException';
  }
}

export class SkipAction extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkipAction';
  }
}
