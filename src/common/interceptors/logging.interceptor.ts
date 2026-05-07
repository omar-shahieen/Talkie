// common/interceptors/logging.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { LoggingService } from '../../logging/logging.service';
import { MyClsStore } from '../interface/cls-store.interface';
import { AuthenticatedRequest } from 'src/auth/types/authenticated-request.type';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly cls: ClsService<MyClsStore>,
    private readonly logger: LoggingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();

    const baseMeta = {
      method: req.method,
      url: req.url,
      correlationId: this.cls.get<string>('correlationId'),
      userId: this.cls.get<string>('userId'),
      ip: this.cls.get<string>('ip'),
    };

    this.logger.log(`→ ${req.method} ${req.url}`, baseMeta);

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`← ${req.method} ${req.url}`, {
          ...baseMeta,
          statusCode: res.statusCode,
          ms: Date.now() - start,
        });
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - start;

        if (err && typeof err === 'object') {
          (err as { ms?: number }).ms = ms;
        }

        return throwError(() => err); // re-throw so the filter still catches it
      }),
    );
  }
}
