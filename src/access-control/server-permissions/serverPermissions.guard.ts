import {
  CanActivate,
  ContextType,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { LoggingService } from '../../logging/logging.service';
import { EventBusService } from '../../events/eventBus.service';
import { AppEvents } from '../../events/events.enum';
import { Request } from 'express';
import { PERMISSION_SERVER_KEY } from './requireServerPermission.decorator';
import { ServerPermissionsService } from './serverPermissions.service';

// ── Dedicated types ──────────────────────────────────────────────────────────

interface AuthenticatedUser {
  email?: string;
  id?: string | number;
  sub?: string | number;
  [key: string]: unknown;
}
interface AuthenticatedRequest extends Request<
  { serverId?: unknown; channelId?: unknown },
  any,
  { serverId?: unknown; channelId?: unknown },
  any
> {
  user?: AuthenticatedUser;
}

interface SocketClient {
  data?: {
    user?: AuthenticatedUser;
    [key: string]: unknown;
  };
}

interface PermissionContext {
  userId?: string;
  serverId?: string;
  channelId?: string;
}

interface WsPayload {
  serverId?: unknown;
  channelId?: unknown;
  [key: string]: unknown;
}

// ── Guard ────────────────────────────────────────────────────────────────────

@Injectable()
export class ServerPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: ServerPermissionsService,
    private readonly logger: LoggingService,
    private readonly eventBus: EventBusService,
  ) {
    this.logger.child({ context: ServerPermissionsGuard.name });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<bigint[]>(
      PERMISSION_SERVER_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const { userId, serverId, channelId } = this.extractContext(context);

    if (!userId || !serverId) {
      this.logger.warn(
        `Permission context rejected: userId=${userId ?? 'missing'} serverId=${serverId ?? 'missing'} channelId=${channelId ?? 'missing'}`,
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
        requiredPermissions: requiredPermissions.map((p) => p.toString()),
        effectivePermissions: perms.toJSON(),
      };

      this.logger.warn(
        `Permission denied for userId=${userId} serverId=${serverId} channelId=${channelId}`,
      );
      this.eventBus.emit(AppEvents.PERMISSION_DENIED, payload);

      throw new ForbiddenException(
        'You do not have the required permissions for this channel action.',
      );
    }

    return true;
  }

  private extractContext(context: ExecutionContext): PermissionContext {
    if (context.getType<ContextType>() === 'http') {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

      return {
        userId: this.resolveUserId(request.user),
        serverId: this.pickString(
          request.params?.serverId ?? request.body?.serverId,
        ),
        channelId: this.pickString(
          request.params?.channelId ?? request.body?.channelId,
        ),
      };
    }

    const client = context.switchToWs().getClient<SocketClient>();
    const payload = context.switchToWs().getData<WsPayload>() ?? {};

    return {
      userId: this.resolveUserId(client.data?.user),
      serverId: this.pickString(payload.serverId),
      channelId: this.pickString(payload.channelId),
    };
  }

  private resolveUserId(
    user: AuthenticatedUser | undefined,
  ): string | undefined {
    if (!user) return undefined;
    const raw = user.sub ?? user.id;
    return raw !== undefined ? String(raw) : undefined;
  }

  private pickString(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return undefined;
  }
}
