import { Reflector } from '@nestjs/core';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PERMISSION_KEY } from './require-permission.decorator';
import { PermissionsService } from './permissions.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<bigint[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true; // No permissions required, allow access
    }

    const request: Request & Record<string, any> = context
      .switchToHttp()
      .getRequest();
    const { userId, serverId, channelId } = this.extractContext(request);

    const perms = this.permissionsService.resolveForChannel(
      userId,
      serverId,
      channelId,
    );

    return perms.hasAll(...requiredPermissions);
  }

  private extractContext(request: Request & Record<string, unknown>) {
    return {
      userId: request.user.id,
      serverId: request.params.serverId ?? request.body.serverId,
      channelId: request.params.channelId ?? request.body.channelId,
    };
  }
}
