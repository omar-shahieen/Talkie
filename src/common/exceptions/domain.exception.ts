// common/exceptions/domain.exceptions.ts
import { HttpStatus } from '@nestjs/common';
import { AppException, AppExceptionContext } from './app.exception';

export class NotFoundException extends AppException {
  constructor(resource: string, id: string, ctx?: AppExceptionContext) {
    super(
      `${resource.toUpperCase()}_NOT_FOUND`,
      HttpStatus.NOT_FOUND,
      ctx?.message ?? `${resource} with id "${id}" was not found`,
      { resourceType: resource, resourceId: id, ...ctx },
    );
  }
}

export class ForbiddenException extends AppException {
  constructor(action: string, ctx?: AppExceptionContext) {
    super(
      'FORBIDDEN',
      HttpStatus.FORBIDDEN,
      ctx?.message ?? `You do not have permission to ${action}`,
      ctx,
    );
  }
}

export class ConflictException extends AppException {
  constructor(message: string, ctx?: AppExceptionContext) {
    super('CONFLICT', HttpStatus.CONFLICT, message, ctx);
  }
}

export class BadRequestException extends AppException {
  constructor(message: string, ctx?: AppExceptionContext) {
    super('BAD_REQUEST', HttpStatus.BAD_REQUEST, message, ctx);
  }
}

export class ValidationException extends AppException {
  constructor(
    public readonly errors: Record<string, string[]>,
    ctx?: AppExceptionContext,
  ) {
    super(
      'VALIDATION_FAILED',
      HttpStatus.UNPROCESSABLE_ENTITY,
      'Validation failed',
      ctx,
    );
  }
}

export class UnauthorizedException extends AppException {
  constructor(reason = 'Authentication required', ctx?: AppExceptionContext) {
    super('UNAUTHORIZED', HttpStatus.UNAUTHORIZED, reason, ctx);
  }
}
