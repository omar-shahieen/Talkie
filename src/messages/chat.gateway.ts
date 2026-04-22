import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { AppEvents } from '../events/events.enum';
import { SocketAuthMiddleware } from 'src/auth/middleware/socket-auth.middleware';
import { RequirePermissions } from '../access-control/rbac/require-permission.decorator';
import { Permission } from '../access-control/rbac/permissions.constants';
import { LoggingService } from 'src/logging/logging.service';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { type AuthenticatedSocket } from 'src/auth/types/authenticated-socket.type';

import { UsersService } from 'src/users/users.service';
import type {
  ChannelRoomPayload,
  MessageCreatedPayload,
  PresencePayload,
  PresenceStatus,
  TypingPayload,
} from './chat.types';
import { PresenceService } from 'src/presence/presence.service';
import { ChannelsService } from 'src/channels/channels.service';

@Injectable()
@WebSocketGateway({
  namespace: 'chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly logger: LoggingService,
    private readonly socketAuthMiddleware: SocketAuthMiddleware,
    private readonly usersService: UsersService,
    private readonly presenceService: PresenceService,
    private readonly channelsService: ChannelsService,
  ) {
    this.logger.child({ context: ChatGateway.name });
  }
  afterInit(server: Server) {
    server.use((socket, next) => {
      this.socketAuthMiddleware.use(socket, next);
    });
  }
  async handleConnection(client: AuthenticatedSocket) {
    const userId = client.data?.user?.id;

    if (!userId) {
      this.logger.warn(`Unauthorized WS connection (Client ID: ${client.id})`);
      client.disconnect();
      return;
    }

    void client.join(`user:${userId}`);

    try {
      // 1. Get restored status BEFORE adding connection
      const restoredStatus =
        await this.presenceService.getRestoredStatus(userId);

      // 2. Add connection with restored status
      const wasOffline = await this.presenceService.addConnections(
        userId,
        client.id,
        restoredStatus, // ← pass it in
      );

      if (wasOffline) {
        await this.broadcastToSharedContexts(userId, restoredStatus);

        // Tell the client what status was restored so UI can reflect it
        client.emit('presence:restored', { status: restoredStatus });
      }
    } catch {
      this.logger.error('Connection error');
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.currentUserId(client);

    void client.leave(`user:${userId}`);
    const WentOffline = await this.presenceService.removeConnection(
      userId,
      client.id,
    );

    this.logger.log(`client ${client.id} leave room for user : ${userId}`);

    if (WentOffline) {
      await this.broadcastToSharedContexts(userId, 'offline');
      this.logger.log(` user : ${userId} go offline`);
    }
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
  async joinChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ChannelRoomPayload,
  ) {
    const isMember = await this.channelsService.isServerMember(
      payload.channelId,
      client.data.user.id,
    );
    if (!isMember) {
      throw new WsException('user is Forbidden to join this channel');
    }
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
  async joinDM(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { channelId: string }, // DMs are just channels now!
  ) {
    const isMember = await this.channelsService.isDmMember(
      payload.channelId,
      client.data.user.id,
    );
    if (!isMember) {
      throw new WsException('user is Forbidden to join this channel');
    }
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
  async setPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: PresencePayload, // { status, dnd_until? }
  ) {
    const userId = this.currentUserId(client);

    // 1. Get current effective status for transition check
    const currentStatus = await this.presenceService.getEffectiveStatus(userId);

    // 2. Validate the transition
    if (
      !this.presenceService.isValidTransition(currentStatus, payload.status)
    ) {
      throw new WsException(
        `Invalid transition: ${currentStatus} → ${payload.status}`,
      );
    }

    // 3. Update Redis
    const isStatusUpdated = await this.presenceService.updateStatus(
      userId,
      client.id,
      payload.status,
    );

    if (!isStatusUpdated) return;

    // 4. Persist preference to DB (non-blocking)
    void this.presenceService.saveStatusPreference(
      userId,
      payload.status,
      payload.dnd_until,
    );

    // 5. Broadcast
    await this.broadcastToSharedContexts(userId, payload.status);

    return { event: 'presence:updated', userId, status: payload.status };
  }
  @SubscribeMessage('presence:heartbeat')
  async heartbeatRefresh(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = this.currentUserId(client);

    await this.presenceService.refreshHeartbeat(userId, client.id);
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

  private async broadcastToSharedContexts(userId: string, status: string) {
    // Fetch servers the user is in from DB
    const serverIds = await this.usersService.getUserServerIds(userId);

    // Emits  to Friends

    // Emits  to shared servers.
    for (const serverId of serverIds) {
      this.server
        .to(`server:${serverId}`)
        .emit('presence:update', { userId, status });
    }
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
    } else {
      this.server.emit('presence:update', payload);
    }
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
