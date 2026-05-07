import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((data: { message?: string; result?: Record<string, any> }) => ({
        success: true,
        message: data.message || 'Request processed successfully',
        data: data.result || data, // Handles cases where   pass a custom message
      })),
    );
  }
}
