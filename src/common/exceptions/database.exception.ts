import { AppException } from './base.exception';

export class DatabaseException extends AppException {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 500, code, context);
  }
}

export class RecordNotFoundException extends AppException {
  constructor(entity: string, id: string | number) {
    super(`${entity} with id "${id}" not found`, 404, 'RECORD_NOT_FOUND', {
      entity,
      id,
    });
  }
}

export class DuplicateKeyException extends AppException {
  constructor(field: string, value: unknown) {
    super(`${field} already exists`, 409, 'DUPLICATE_KEY', { field, value });
  }
}
