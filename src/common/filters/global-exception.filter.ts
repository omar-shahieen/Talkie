// filters/global-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../exceptions/base.exception';
import { AsyncContext } from '../context/async-context.service';
import { LoggingService } from 'src/logging/logging.service';
import { ErrorResponse } from './interfaces/errorResponse.interface';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly asyncContext: AsyncContext,
    private readonly logger: LoggingService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const isDev = process.env.NODE_ENV !== 'production';

    const { statusCode, code, message, context, isOperational } =
      this.normalize(exception);

    const correlationId =
      (req.headers['x-correlation-id'] as string) ??
      this.asyncContext.get('correlationId') ??
      crypto.randomUUID();

    const body: ErrorResponse = {
      statusCode,
      code,
      message: isDev ? message : this.sanitize(statusCode, message),
      correlationId,
      timestamp: new Date().toISOString(),
      path: req.url,
      ...(isDev && { stack: (exception as Error)?.stack, context }),
    };

    // Log according to severity
    const logMeta = JSON.stringify({ correlationId, path: req.url, context });
    const stack = exception instanceof Error ? exception.stack : undefined;

    if (!isOperational || statusCode >= 500) {
      this.logger.error(message, stack, logMeta);
    } else if (statusCode >= 400) {
      this.logger.warn(message, logMeta);
    }
    // If it's a non-operational error (programming bug), crash the process
    // after a delay so the response still sends to the client. This allows us to catch and fix bugs instead of silently swallowing them.
    if (!isOperational) {
      setTimeout(() => process.exit(1), 500);
    }

    res.status(statusCode).json(body);
  }

  private normalize(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
    context?: Record<string, unknown>;
    isOperational: boolean;
  } {
    if (exception instanceof AppException) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        context: exception.context,
        isOperational: exception.isOperational,
      };
    }
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const message =
        typeof res === 'string' ? res : (res as { message: string }).message;
      return {
        statusCode: exception.getStatus(),
        code: 'HTTP_EXCEPTION',
        message: Array.isArray(message) ? message.join('; ') : message,
        isOperational: true,
      };
    }
    // Unknown / programming error
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      isOperational: false,
    };
  }

  /** Never leak internal details to production clients */
  private sanitize(status: number, message: string): string {
    if (status >= 500)
      return 'An internal error occurred. Our team has been notified.';
    return message; // 4xx are safe to surface
  }
}
