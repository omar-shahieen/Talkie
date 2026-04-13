import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { jwtConstants, JwtPayload } from '../auth/constants';
import { AppEvents } from '../events/events.enum';
import { Server, Socket } from 'socket.io';
import { RealtimeAuthGuard } from './realtime-auth.guard';
import { PermissionGuard } from '../access-control/rbac/permissions.guard';
import { RequirePermissions } from '../access-control/rbac/require-permission.decorator';
import { Permission } from '../access-control/rbac/permissions.constants';

type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';

interface SocketUser extends JwtPayload {
  email?: string;
  status?: PresenceStatus;
}

interface SocketContext {
  user?: SocketUser;
}

interface ChannelRoomPayload {
  serverId: string;
  channelId: string;
}

interface TypingPayload extends ChannelRoomPayload {
  isTyping?: boolean;
}

interface PresencePayload {
  status: PresenceStatus;
}

@Injectable()
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
@UseGuards(RealtimeAuthGuard, PermissionGuard)
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    const user = await this.authenticate(client);

    if (!user) {
      client.emit('error', {
        error: 'Unauthorized websocket connection',
        code: 'WS_UNAUTHORIZED',
      });
      client.disconnect(true);
      return;
    }

    (client.data as SocketContext).user = user;

    client.emit('connection:ready', {
      userId: user.sub,
      status: 'online',
    });

    this.logger.log(`Socket connected: ${client.id} (${user.sub})`);
  }

  handleDisconnect(client: Socket): void {
    const userId = this.currentUserId(client);

    if (userId) {
      this.broadcastPresence(userId, 'offline', client);
    }

    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('server:join')
  joinServer(
    @ConnectedSocket() client: Socket,
    @MessageBody() serverId: string,
  ) {
    void client.join(this.serverRoom(serverId));
    return { event: 'server:joined', serverId };
  }

  @SubscribeMessage('server:leave')
  leaveServer(
    @ConnectedSocket() client: Socket,
    @MessageBody() serverId: string,
  ) {
    void client.leave(this.serverRoom(serverId));
    return { event: 'server:left', serverId };
  }

  @SubscribeMessage('channel:join')
  @RequirePermissions(Permission.ViewChannel)
  joinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChannelRoomPayload,
  ) {
    void client.join(this.serverRoom(payload.serverId));
    void client.join(this.channelRoom(payload.channelId));
    return { event: 'channel:joined', ...payload };
  }

  @SubscribeMessage('channel:leave')
  leaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChannelRoomPayload,
  ) {
    void client.leave(this.channelRoom(payload.channelId));
    return { event: 'channel:left', ...payload };
  }

  @SubscribeMessage('typing:start')
  @RequirePermissions(Permission.SendMessages)
  startTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingPayload,
  ) {
    this.emitToChannel(payload.channelId, 'typing:start', {
      serverId: payload.serverId,
      channelId: payload.channelId,
      userId: this.currentUserId(client),
      isTyping: true,
    });

    return { event: 'typing:started', ...payload };
  }

  @SubscribeMessage('typing:stop')
  @RequirePermissions(Permission.SendMessages)
  stopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingPayload,
  ) {
    this.emitToChannel(payload.channelId, 'typing:stop', {
      serverId: payload.serverId,
      channelId: payload.channelId,
      userId: this.currentUserId(client),
      isTyping: false,
    });

    return { event: 'typing:stopped', ...payload };
  }

  @SubscribeMessage('presence:set')
  setPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PresencePayload,
  ) {
    const userId = this.currentUserId(client);
    this.broadcastPresence(userId, payload.status, client);

    return { event: 'presence:updated', userId, status: payload.status };
  }

  @OnEvent(AppEvents.MESSAGE_CREATED)
  handleMessageCreated(payload: Record<string, unknown>) {
    this.emitToChannel(
      this.readString(payload, 'channelId'),
      'message:created',
      payload,
    );
  }

  @OnEvent(AppEvents.MESSAGE_UPDATED)
  handleMessageUpdated(payload: Record<string, unknown>) {
    this.emitToChannel(
      this.readString(payload, 'channelId'),
      'message:updated',
      payload,
    );
  }

  @OnEvent(AppEvents.MESSAGE_DELETED)
  handleMessageDeleted(payload: Record<string, unknown>) {
    this.emitToChannel(
      this.readString(payload, 'channelId'),
      'message:deleted',
      payload,
    );
  }

  @OnEvent(AppEvents.MESSAGE_REACTION_ADDED)
  handleReactionAdded(payload: Record<string, unknown>) {
    this.emitToChannel(
      this.readString(payload, 'channelId'),
      'reaction:added',
      payload,
    );
  }

  @OnEvent(AppEvents.MESSAGE_REACTION_REMOVED)
  handleReactionRemoved(payload: Record<string, unknown>) {
    this.emitToChannel(
      this.readString(payload, 'channelId'),
      'reaction:removed',
      payload,
    );
  }

  @OnEvent(AppEvents.PRESENCE_UPDATED)
  handlePresenceUpdated(payload: Record<string, unknown>) {
    const userId = this.readString(payload, 'userId');
    const rawStatus = this.readField(payload, 'status');
    const status: PresenceStatus = this.isPresenceStatus(rawStatus)
      ? rawStatus
      : 'online';

    this.broadcastPresence(userId, status, undefined);
  }

  @OnEvent(AppEvents.TYPING_STARTED)
  handleTypingStarted(payload: Record<string, unknown>) {
    this.emitToChannel(
      this.readString(payload, 'channelId'),
      'typing:start',
      payload,
    );
  }

  @OnEvent(AppEvents.TYPING_STOPPED)
  handleTypingStopped(payload: Record<string, unknown>) {
    this.emitToChannel(
      this.readString(payload, 'channelId'),
      'typing:stop',
      payload,
    );
  }

  private async authenticate(client: Socket): Promise<JwtPayload | null> {
    const token = this.extractToken(client);

    if (!token) {
      return null;
    }

    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: jwtConstants.secret,
      });
    } catch {
      return null;
    }
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    const authToken = auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string') {
      const [type, token] = header.split(' ');
      if (type === 'Bearer' && token) {
        return token;
      }
    }

    const query = client.handshake.query as { token?: unknown };
    const queryToken = query.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken;
    }

    return undefined;
  }

  private currentUserId(client: Socket): string {
    return (client.data as SocketContext).user?.sub?.toString() ?? '';
  }

  private serverRoom(serverId: string): string {
    return `server:${serverId}`;
  }

  private channelRoom(channelId: string): string {
    return `channel:${channelId}`;
  }

  private emitToChannel(
    channelId: string,
    event: string,
    payload: Record<string, unknown>,
  ): void {
    if (!channelId) {
      return;
    }

    this.server.to(this.channelRoom(channelId)).emit(event, payload);
  }

  private readField(payload: Record<string, unknown>, field: string): unknown {
    return payload[field];
  }

  private readString(payload: Record<string, unknown>, field: string): string {
    const value = this.readField(payload, field);
    return typeof value === 'string' ? value : '';
  }

  private broadcastPresence(
    userId: string,
    status: PresenceStatus,
    client?: Socket,
  ): void {
    const payload = { userId, status };

    if (client) {
      for (const room of client.rooms) {
        if (room.startsWith('server:')) {
          this.server.to(room).emit('presence:update', payload);
        }
      }
      return;
    }

    this.server.emit('presence:update', payload);
  }

  private isPresenceStatus(value: unknown): value is PresenceStatus {
    return (
      value === 'online' ||
      value === 'idle' ||
      value === 'dnd' ||
      value === 'offline'
    );
  }
}
