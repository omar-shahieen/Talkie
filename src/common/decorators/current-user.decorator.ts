import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from 'src/auth/types/authenticated-request.type';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
    return data ? user?.[data] : user;
  },
);
