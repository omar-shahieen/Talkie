import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { map } from 'rxjs/operators';
import { MyClsStore } from '../interface/cls-store.interface';
import { SuccessResponseDto } from '../dto/success-response.dto';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(
    private configService: ConfigService,
    private cls: ClsService<MyClsStore>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const isDev = this.configService.get('NODE_ENV') === 'development';

    return next.handle().pipe(
      map(
        (data: {
          message?: string;
          results?: Record<string, any>;
          ms?: number;
        }): SuccessResponseDto => {
          const { message, ms, ...results } = data;

          const response: SuccessResponseDto = {
            success: true,
            message: message || 'Operation completed successfully',
            results: results,
            timestamp: new Date().toISOString(),
          };

          // Only include sensitive metadata in development mode
          if (isDev) {
            return {
              ...response,
              ms,
              correlationId: this.cls.get<string>('correlationId'),
              ip: this.cls.get<string>('ip') ?? 'anonymous',
              userId: this.cls.get<string>('userId') ?? 'anonymous',
            };
          }

          return response;
        },
      ),
    );
  }
}
