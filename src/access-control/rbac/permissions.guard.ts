import { Reflector } from '@nestjs/core';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PERMISSION_KEY } from './require-permission.decorator';
import { PermissionsService } from './permissions.service';
import { LoggingService } from '../../logging/logging.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { AppEvents } from '../../common/events/events.enum';

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
    private readonly logger: LoggingService,
    private readonly eventBus: EventBusService,
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

    if (!userId || !serverId || !channelId) {
      this.logger.warn(
        `Permission context rejected: userId=${userId ?? 'missing'} serverId=${serverId ?? 'missing'} channelId=${channelId ?? 'missing'}`,
        PermissionsGuard.name,
      );
      throw new ForbiddenException(
        'Permission context is incomplete: userId, serverId and channelId are required.',
      );
    }

    const perms = await this.permissionsService.resolveForChannel(
      userId,
      serverId,
      channelId,
    );
    const isAllowed = perms.hasAll(...requiredPermissions);

    if (!isAllowed) {
      const payload = {
        userId,
        serverId,
        channelId,
        requiredPermissions: requiredPermissions.map((perm) => perm.toString()),
        effectivePermissions: perms.toJSON(),
      };

      this.logger.warn(
        `Permission denied for userId=${userId} serverId=${serverId} channelId=${channelId}`,
        PermissionsGuard.name,
      );
      this.eventBus.emit(AppEvents.PERMISSION_DENIED, payload);

      throw new ForbiddenException(
        'You do not have the required permissions for this channel action.',
      );
    }

    return true;
  }

  private extractContext(request: AuthenticatedRequest) {
    return {
      userId: request.user.id,
      serverId: request.params.serverId ?? request.body.serverId ?? null,
      channelId: request.params.channelId ?? request.body.channelId ?? null,
    };
  }
}
