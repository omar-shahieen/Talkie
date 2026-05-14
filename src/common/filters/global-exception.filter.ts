// filters/global-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';

import { QueryFailedError } from 'typeorm';
import { LoggingService } from '../../logging/logging.service';
import { ClsService } from 'nestjs-cls';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { ValidationException } from '../exceptions/domain.exception';
import { EventBusService } from '../../events/eventBus.service';
import { AppEvents } from '../../events/events.enum';
import { ConfigService } from '@nestjs/config';

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
    private readonly cls: ClsService,
    private readonly config: ConfigService,
    private readonly logger: LoggingService,
    private readonly emiter: EventBusService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const req = ctx.getRequest<Request & { user?: { id: string } }>();
    const res = ctx.getResponse<Response>();

    const isDev = this.config.get<string>('NODE_ENV') !== 'production';

    const {
      statusCode,
      errorCode,
      message,
      context,
      isOperational,
      validationErrors,
    } = this.normalize(exception);

    const ms =
      exception && typeof exception === 'object'
        ? (exception as { ms?: number }).ms
        : undefined;

    const correlationId =
      (req.headers['x-correlation-id'] as string) ??
      this.cls.get<string>('correlationId') ??
      crypto.randomUUID();

    const responseBody: ErrorResponseDto = {
      success: false,
      statusCode,
      errorCode,
      message: isDev ? message : this.sanitize(statusCode, message),
      timestamp: new Date().toISOString(),
      path: req.url,
      ...(isDev && typeof ms === 'number' && { ms }),
      ...(isDev ? { correlationId } : {}),
      ...(validationErrors && { errors: validationErrors }),
      ...(isDev && { stack: (exception as Error)?.stack, context }),
    };

    this.handleAuditAndLogging(
      exception,
      req,
      responseBody,
      statusCode,
      isOperational,
    );

    res.status(statusCode).json(responseBody);
  }

  private handleAuditAndLogging(
    exception: unknown,
    request: Request,
    response: ErrorResponseDto,
    statusCode: number,
    isOperational: boolean,
  ): void {
    const logPayload = {
      context: GlobalExceptionFilter.name,
      action:
        exception instanceof AppException
          ? (exception.context.action ?? exception.errorCode)
          : 'UNHANDLED',
      statusCode,
      errorCode: response.errorCode,
      message: response.message,
      ms: response.ms,
      path: request.url,
      method: request.method,
      userAgent: request.headers['user-agent'],
      exceptionContext:
        exception instanceof AppException ? exception.context : undefined,
    };

    if (!isOperational) {
      // Programmer error — log as error with full stack
      this.logger.error('Unhandled exception', {
        ...logPayload,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    } else if (statusCode >= 500) {
      this.logger.error(logPayload.message, logPayload);
    } else {
      this.logger.warn(logPayload.message, logPayload);
    }

    // Audit trail — only for security-sensitive errors
    if ([401, 403, 429].includes(statusCode)) {
      this.emiter.emit(AppEvents.SECURITY_ERROR, {
        action: AppEvents.SECURITY_ERROR,
        resourceType: 'HTTP',
        resourceId: request.url,
        metadata: logPayload,
      });
    }
  }
  private normalize(exception: unknown) {
    if (exception instanceof ValidationException) {
      return {
        statusCode: exception.statusCode,
        errorCode: exception.errorCode,
        message: exception.message,
        stack: exception.stack,
        validationErrors: exception.errors,
        isOperational: exception.isOperational,
      };
    }
    if (exception instanceof AppException) {
      return {
        statusCode: exception.statusCode,
        errorCode: exception.errorCode,
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
            errorCode: 'DUPLICATE_KEY',
            message: 'A record with this value already exists.',
            context: { detail: driverError?.detail },
            isOperational: true,
          };

        case '23503': // foreign_key_violation
          return {
            statusCode: 409,
            errorCode: 'FOREIGN_KEY_VIOLATION',
            message:
              'The referenced record does not exist or is currently in use.',
            context: { table: driverError?.table, detail: driverError?.detail },
            isOperational: true,
          };

        case '23502': // not_null_violation
          return {
            statusCode: 400,
            errorCode: 'MISSING_REQUIRED_FIELD',
            message: `A required field is missing data.`,
            context: { column: driverError?.column },
            isOperational: true,
          };

        case '22P02': // invalid_text_representation (e.g., passing a word into a UUID/Integer field)
          return {
            statusCode: 400,
            errorCode: 'INVALID_INPUT_FORMAT',
            message:
              'The data provided is in an invalid format for the target field.',
            isOperational: true,
          };

        case '23514': // check_violation (e.g., failing a custom CHECK constraint in the DB)
          return {
            statusCode: 400,
            errorCode: 'CHECK_CONSTRAINT_FAILED',
            message: 'The provided data failed a database validation check.',
            context: { table: driverError?.table },
            isOperational: true,
          };
      }
    }
    // Unknown / programming error
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_ERROR',
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
