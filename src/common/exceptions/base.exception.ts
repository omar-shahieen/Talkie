export class AppException extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: string, // machine-readable code e.g. "USER_NOT_FOUND"
    public readonly context?: Record<string, unknown>,
    public readonly isOperational = true, // false = programming bug, crash process
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
