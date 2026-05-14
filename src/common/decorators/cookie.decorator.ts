import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UnauthorizedException } from '../exceptions/domain.exception';

type CookieRequest = Request & {
  cookies?: Record<string, string>;
};

export const Cookies = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<CookieRequest>();
    const cookies: Record<string, string | undefined> | undefined =
      request.cookies;
    const cookie: string | Record<string, string | undefined> | undefined = data
      ? cookies?.[data]
      : cookies;

    // Logic: If a specific cookie name was requested but not found
    if (data && !cookie) {
      throw new UnauthorizedException(`Cookie "${data}" is required`, {
        action: 'readCookie',
        cookieName: data,
      });
    }

    return cookie;
  },
);
