import { OnEvent } from '@nestjs/event-emitter';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { SocketAuthMiddleware } from 'src/auth/middleware/socket-auth.middleware';
import { AuthenticatedSocket } from 'src/auth/types/authenticated-socket.type';
import { LoggingService } from 'src/logging/logging.service';
import { type NotificationDto } from './dtos/notification.dto';

@WebSocketGateway({ namespace: 'notifications' })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  constructor(
    private readonly logger: LoggingService,
    private readonly socketAuthMiddleware: SocketAuthMiddleware,
  ) {
    this.logger.child({ context: NotificationsGateway.name });
  }

  @WebSocketServer()
  server!: Server;

  afterInit(server: Server) {
    server.use((socket, next) => {
      this.socketAuthMiddleware.use(socket, next);
    });
  }

  handleConnection(client: AuthenticatedSocket) {
    const userId = client.data.user.id;

    if (userId) {
      //  Join the "User Room"
      // If the user logs in on Chrome and a Mobile App,
      // BOTH sockets will now be in the room "user_123"
      void client.join(`user:${userId}`);
      this.logger.log(`user ${userId} joined notification room`);
    } else {
      // If someone connected without auth, boot them out
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.user.id;
    if (userId) {
      void client.leave(`user:${userId}`);
      this.logger.log(`user ${userId} left notification room`);
    }
  }

  // listen to internal events

  @OnEvent('notification.created')
  handleNotificationCreated(notification: NotificationDto) {
    // Broadcast only to the specific user's room
    this.server
      .to(`user:${notification.recipientId}`)
      .emit('notification:recieved', notification);
  }

  @OnEvent('notification.markRead')
  handleNotificationRead(payload: { userId: string; notificationId: string }) {
    this.server
      .to(`user:${payload.userId}`)
      .emit('notification:cleared', payload.notificationId);
  }
}
