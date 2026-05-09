import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../../logging/logging.service';
import { MyClsStore } from '../interface/cls-store.interface';
import { AuthenticatedRequest } from 'src/auth/types/authenticated-request.type';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly cls: ClsService<MyClsStore>,
    private readonly logger: LoggingService,
    private readonly metrics: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();
    const isDev = this.configService.get('NODE_ENV') === 'development';

    const baseMeta = {
      context: LoggingInterceptor.name,
      method: req.method,
      // Use path to avoid logging query strings and potentially sensitive data
      url: req.path,
      correlationId: this.cls.get<string>('correlationId'),
      userId: this.cls.get<string>('userId'),
      ip: this.cls.get<string>('ip'),
    };

    this.logger.log(`→ ${req.method} ${req.path}`, baseMeta);

    return next.handle().pipe(
      tap(() => {
        const route =
          (req.route as { path?: string } | undefined)?.path ?? req.path;

        this.logger.log(`← ${req.method} ${req.path}`, {
          ...baseMeta,
          statusCode: res.statusCode,
          ms: Date.now() - start,
          route,
        });

        this.metrics.recordRequest(
          req.method,
          route,
          res.statusCode,
          Date.now() - start,
        );
      }),
      map((data: any): any => {
        // transorm for responses
        const ms = Date.now() - start;

        // Only attach sensitive metadata in development mode
        if (isDev) {
          return {
            ...data,
            ms,
          };
        }

        return data;
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - start;

        if (err && typeof err === 'object') {
          const mutableErr = err as { ms?: number; context?: string };
          mutableErr.ms = ms;
          mutableErr.context = LoggingInterceptor.name;
        }

        return throwError(() => err); // re-throw so the filter still catches it
      }),
    );
  }
}
