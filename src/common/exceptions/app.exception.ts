export interface AppExceptionContext {
  action?: string;
  userId?: string;
  resourceId?: string;
  resourceType?: string;
  message?: string;
  [key: string]: unknown;
}

export class AppException extends Error {
  constructor(
    public readonly errorCode: string, // e.g. 'USER_NOT_FOUND'
    public readonly statusCode: number, // HTTP status
    message: string,
    public readonly context: AppExceptionContext = {},
    public readonly isOperational = true, // false = programmer error → 500
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
