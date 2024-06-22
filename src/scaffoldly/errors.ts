export const RETURN_CODE_NOT_LOGGED_IN = 10;

export class ErrorWithReturnCode extends Error {
  constructor(public readonly returnCode: number, message: string) {
    super(message);
  }
}
