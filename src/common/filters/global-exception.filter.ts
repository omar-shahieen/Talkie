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
import { QueryFailedError } from 'typeorm';

//  Define the shape of a Postgres driver error
// Postgres provides more context than just 'code', so we type those too.
interface PostgresDriverError {
  code?: string;
  detail?: string; // e.g., "Key (email)=(test@test.com) already exists."
  table?: string;
  column?: string;
}
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
      this.logger.warn('unhandled programming error', logMeta);
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
    // Check if it's a TypeORM database error
    if (exception instanceof QueryFailedError) {
      const driverError = exception.driverError as
        | PostgresDriverError
        | undefined;
      const code = driverError?.code;

      // 2. Handle specific Postgres error codes
      switch (code) {
        case '23505': // unique_violation
          return {
            statusCode: 409,
            code: 'DUPLICATE_KEY',
            message: 'A record with this value already exists.',
            context: { detail: driverError?.detail },
            isOperational: true,
          };

        case '23503': // foreign_key_violation
          return {
            statusCode: 409, // or 400, depending on your preference
            code: 'FOREIGN_KEY_VIOLATION',
            message:
              'The referenced record does not exist or is currently in use.',
            context: { table: driverError?.table, detail: driverError?.detail },
            isOperational: true,
          };

        case '23502': // not_null_violation
          return {
            statusCode: 400,
            code: 'MISSING_REQUIRED_FIELD',
            message: `A required field is missing data.`,
            context: { column: driverError?.column },
            isOperational: true,
          };

        case '22P02': // invalid_text_representation (e.g., passing a word into a UUID/Integer field)
          return {
            statusCode: 400,
            code: 'INVALID_INPUT_FORMAT',
            message:
              'The data provided is in an invalid format for the target field.',
            isOperational: true,
          };

        case '23514': // check_violation (e.g., failing a custom CHECK constraint in the DB)
          return {
            statusCode: 400,
            code: 'CHECK_CONSTRAINT_FAILED',
            message: 'The provided data failed a database validation check.',
            context: { table: driverError?.table },
            isOperational: true,
          };
      }
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
