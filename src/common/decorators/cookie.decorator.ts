import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export const Cookies = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const cookie = data ? request.cookies?.[data] : request.cookies;

    // Logic: If a specific cookie name was requested but not found
    if (data && !cookie) {
      throw new UnauthorizedException(`Cookie "${data}" is required`);
    }

    return cookie;
  },
);
