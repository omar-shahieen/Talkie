import { Injectable, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';

import { AppEvents } from '../events/events.enum';
import { RealtimeAuthGuard } from '../auth/guards/auth-realtime.guard';
import { RequirePermissions } from '../access-control/rbac/require-permission.decorator';
import { Permission } from '../access-control/rbac/permissions.constants';
import { LoggingService } from 'src/logging/logging.service';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { Notification } from 'src/notifications/entities/notification.entity';
import { type AuthenticatedSocket } from 'src/auth/types/authenticated-socket.type';

type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';

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

interface MessageCreatedPayload {
  id: string;
  channelId: string;
  content: string;
  authorId: string;
  createdAt: Date;

  // These might be explicitly added by your MessageService before emitting
  serverId?: string; // Will exist if it's a Server channel
  senderId?: string; // Used for DMs
  recipientId?: string; // Used for DMs
}

@Injectable()
@UseGuards(RealtimeAuthGuard)
@WebSocketGateway({
  namespace: 'chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly logger: LoggingService,
  ) {
    this.logger.child({ context: ChatGateway.name });
  }

  handleConnection(client: AuthenticatedSocket) {
    const user = client.data.user;

    client.emit('connection:ready', {
      userId: user.id,
      status: 'online',
    });

    void this.logger.log(`Socket connected: ${client.id} (${user.id})`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.currentUserId(client);

    if (userId) {
      this.broadcastPresence(userId, 'offline', client);
    }

    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('server:join')
  joinServer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() serverId: string,
  ) {
    void client.join(this.serverRoom(serverId));
    return { event: 'server:joined', serverId };
  }

  @SubscribeMessage('server:leave')
  leaveServer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() serverId: string,
  ) {
    void client.leave(this.serverRoom(serverId));
    return { event: 'server:left', serverId };
  }

  @SubscribeMessage('channel:join')
  @RequirePermissions(Permission.ViewChannel)
  joinChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ChannelRoomPayload,
  ) {
    void client.join(this.serverRoom(payload.serverId));
    void client.join(this.channelRoom(payload.channelId));
    return { event: 'channel:joined', ...payload };
  }

  @SubscribeMessage('channel:leave')
  leaveChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ChannelRoomPayload,
  ) {
    void client.leave(this.channelRoom(payload.channelId));
    return { event: 'channel:left', ...payload };
  }

  @SubscribeMessage('dm:join')
  joinDM(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { channelId: string }, // DMs are just channels now!
  ) {
    // Before doing this, you'd usually query the DB to ensure this client.user.id
    // actually exists in the ChannelMember table for this channelId.
    void client.join(this.channelRoom(payload.channelId));
    return { event: 'dm:joined', channelId: payload.channelId };
  }

  @SubscribeMessage('dm:leave')
  leaveDM(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { channelId: string },
  ) {
    void client.leave(this.channelRoom(payload.channelId));
    return { event: 'dm:left', channelId: payload.channelId };
  }

  @SubscribeMessage('typing:start')
  @RequirePermissions(Permission.SendMessages)
  startTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
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
    @ConnectedSocket() client: AuthenticatedSocket,
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
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: PresencePayload,
  ) {
    const userId = this.currentUserId(client);
    this.broadcastPresence(userId, payload.status, client);

    return { event: 'presence:updated', userId, status: payload.status };
  }

  @OnEvent(AppEvents.MESSAGE_CREATED)
  handleMessageCreated(payload: MessageCreatedPayload) {
    const channelId = payload.channelId;
    const serverId = payload.serverId;
    const messageId = payload.id;
    // emit the message to active users
    this.server
      .to(this.channelRoom(channelId))
      .emit('message:created', payload);

    // emit unread trigger
    if (serverId) {
      // it is a server channel , emit to the whole server to update the bold indicator
      this.server.to(this.serverRoom(serverId)).emit('channel:updated', {
        channelId,
        lastMessageId: messageId,
      });
    } else {
      // It's a DM! Emit to the two specific users.
      // Payload for DMs MUST include `recipientId` and `senderId` from your message creation service.
      if (payload.senderId) {
        this.server.to(`user:${payload.senderId}`).emit('channel:updated', {
          channelId,
          lastMessageId: messageId,
        });
      }

      if (payload.recipientId) {
        this.server.to(`user:${payload.recipientId}`).emit('channel:updated', {
          channelId,
          lastMessageId: messageId,
        });
      }
    }
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
    const rawStatus = payload.status;
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

  private currentUserId(client: AuthenticatedSocket): string {
    return client.data.user.id?.toString() ?? '';
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

  private readString(payload: Record<string, unknown>, field: string): string {
    const value = payload[field];
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
