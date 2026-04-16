// middleware/
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncContext } from '../context/async-context.service';

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  constructor(private readonly asyncContext: AsyncContext) {}

  use(
    req: Request & { user: { id: string } },
    _res: Response,
    next: NextFunction,
  ) {
    this.asyncContext.run(() => {
      const correlationId =
        (req.headers['x-correlation-id'] as string) ?? crypto.randomUUID();
      req.headers['x-correlation-id'] = correlationId;
      this.asyncContext.set('correlationId', correlationId);
      this.asyncContext.set('userId', req['user']?.id);
      this.asyncContext.set('ip', req.ip);
      next();
    });
  }
}
