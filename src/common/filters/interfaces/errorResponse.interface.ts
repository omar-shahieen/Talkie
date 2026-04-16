export interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  correlationId: string;
  timestamp: string;
  path: string;
  // only in development:
  stack?: string;
  context?: Record<string, unknown>;
}
