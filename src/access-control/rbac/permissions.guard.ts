import { Reflector } from '@nestjs/core';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PERMISSION_KEY } from './require-permission.decorator';
import { PermissionsService } from './permissions.service';

import { Request } from 'express';

// This matches your JWT payload structure
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
  // Define params/body if you want extra strictness
  params: {
    serverId?: string;
    channelId?: string;
  };
  body: {
    serverId?: string;
    channelId?: string;
  };
}
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
      return true; // No permissions required, allow access
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { userId, serverId, channelId } = this.extractContext(request);
    // 3. Ensure these variables exist (Basic Runtime Safety)
    if (!userId || !serverId || !channelId) {
      return false;
    }
    const perms = await this.permissionsService.resolveForChannel(
      userId,
      serverId,
      channelId,
    );
    console.log(perms);
    console.log(requiredPermissions);
    return perms.hasAll(...requiredPermissions);
  }

  private extractContext(request: AuthenticatedRequest) {
    return {
      userId: request.user.id,
      serverId: request.params.serverId ?? request.body.serverId ?? null,
      channelId: request.params.channelId ?? request.body.channelId ?? null,
    };
  }
}
