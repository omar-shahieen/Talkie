import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AsyncContext } from '../context/async-context.service';
import { LoggingService } from '../../logging/logging.service';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly asyncContext: AsyncContext,
    private readonly logger: LoggingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const start = Date.now();

    const meta = {
      method: req.method,
      url: req.url,
      correlationId: this.asyncContext.get<string>('correlationId'),
      userId: this.asyncContext.get<string | number>('userId'),
    };

    const asContext = (extra?: Record<string, unknown>) =>
      JSON.stringify({ ...meta, ...extra });

    this.logger.log('-> ' + req.method + ' ' + req.url, asContext());

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.log(
          '<- ' + req.method + ' ' + req.url + ' ' + ms + 'ms',
          asContext({ ms }),
        );
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - start;
        this.logger.debug(
          'x ' + req.method + ' ' + req.url + ' ' + ms + 'ms',
          asContext({ ms }),
        );
        return throwError(() => err);
      }),
    );
  }
}
