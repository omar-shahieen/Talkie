// common/interceptors/correlation-id.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { MyClsStore } from '../interface/cls-store.interface';
import { AuthenticatedRequest } from 'src/auth/types/authenticated-request.type';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService<MyClsStore>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const correlationId =
      (req.headers['x-correlation-id'] as string) ?? crypto.randomUUID();

    this.cls.set('correlationId', correlationId);
    this.cls.set('userId', req['user']?.id);

    // Echo it back so the client can correlate on their side
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('x-correlation-id', correlationId);

    return next.handle();
  }
}
