import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from './require-permission.decorator';
import { PermissionsService } from './permissions.service';
import { Request } from 'express';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<bigint[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const { userId, serverId, channelId } = this.extractContext(context);
    if (!userId || !channelId) {
      throw new UnauthorizedException();
    }

    const perms = await this.permissionsService.resolveForChannel(
      userId,
      serverId,
      channelId,
    );

    if (!perms.hasAll(...requiredPermissions)) {
      throw new ForbiddenException();
    }

    return true;
  }

  private extractContext(context: ExecutionContext): {
    userId?: string;
    serverId?: string;
    channelId?: string;
  } {
    if (context.getType<'http' | 'ws'>() === 'http') {
      const request = context
        .switchToHttp()
        .getRequest<Request & Record<string, any>>();
      const user = request.user as Record<string, unknown> | undefined;

      return {
        userId: user ? String(user.sub ?? user.id) : undefined,
        serverId: this.pickString(request.params.serverId ?? request.body.serverId),
        channelId: this.pickString(
          request.params.channelId ?? request.body.channelId,
        ),
      };
    }

    const client = context.switchToWs().getClient<{
      data?: Record<string, any>;
    }>();
    const payload = context.switchToWs().getData<Record<string, any>>() ?? {};
    const socketUser = client.data?.user;

    return {
      userId: socketUser ? String(socketUser.sub ?? socketUser.id) : undefined,
      serverId: this.pickString(payload.serverId),
      channelId: this.pickString(payload.channelId),
    };
  }

  private pickString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }

    return undefined;
  }
}

export { PermissionsGuard as PermissionGuard };
