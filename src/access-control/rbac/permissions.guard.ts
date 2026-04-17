import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
<<<<<<< HEAD
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PERMISSION_KEY } from './require-permission.decorator';
import { PermissionsService } from './permissions.service';
import { LoggingService } from '../../logging/logging.service';
import { EventBusService } from '../../events/event-bus.service';
import { AppEvents } from '../../events/events.enum';

=======
import { PERMISSION_KEY } from './require-permission.decorator';
import { PermissionsService } from './permissions.service';
>>>>>>> 94bb6182375aedd915386855484f9a84710886df
import { Request } from 'express';

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
      return true;
    }

<<<<<<< HEAD
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
=======
    const { userId, serverId, channelId } = this.extractContext(context);
    if (!userId || !channelId) {
      throw new UnauthorizedException();
>>>>>>> 94bb6182375aedd915386855484f9a84710886df
    }

    const perms = await this.permissionsService.resolveForChannel(
      userId,
      serverId,
      channelId,
    );
<<<<<<< HEAD
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
=======

    if (!perms.hasAll(...requiredPermissions)) {
      throw new ForbiddenException();
>>>>>>> 94bb6182375aedd915386855484f9a84710886df
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
