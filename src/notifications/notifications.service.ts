import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { AppEvents } from 'src/events/events.enum';
import { OnEvent } from '@nestjs/event-emitter';
import { EventBusService } from 'src/events/event-bus.service';
import { LoggingService } from 'src/logging/logging.service';
import { type MessageSendDto } from './dtos/messageSend.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepo: Repository<Notification>,
    private eventEmitter: EventBusService,
    private logger: LoggingService,
  ) {
    this.logger.child({ context: NotificationsService.name });
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.notificationsRepo.update(notificationId, { isRead: true });
    this.eventEmitter.emit('notification.markRead', {
      notificationId,
      userId,
    });

    return { success: true };
  }

  async findUserNotifications(userId: string) {
    return this.notificationsRepo.find({
      where: { recipientId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  @OnEvent(AppEvents.MESSAGE_CREATED)
  async handleDmMessageCreated(payload: MessageSendDto) {
    if (payload.type == 'DM' && payload.isDirectMessage) {
      const notification = this.notificationsRepo.create({
        recipientId: payload.recepientId,
        senderId: payload.senderId,
        type: NotificationType.DM,
        link: `/channels/@me/${payload.senderId}`, // Deep link for frontend
        content: `sent you a message`,
      });

      const saved = await this.notificationsRepo.save(notification);

      this.logger.log(
        `Notification is created for user : ${payload.recepientId} with id : ${saved.id} `,
      );
      this.eventEmitter.emit('notification.created', { ...saved });
    }
  }
  @OnEvent(AppEvents.MESSAGE_CREATED)
  async handleMentionsMessageCreated(payload: MessageSendDto) {
    if (
      payload.type == 'mention' &&
      payload.mentions &&
      payload.mentions.length > 0
    ) {
      for (const mentionendUser of payload.mentions) {
        if (mentionendUser === payload.senderId) continue;

        const notification = this.notificationsRepo.create({
          recipientId: mentionendUser,
          senderId: payload.senderId,
          serverId: payload.serverId,
          channelId: payload.channelId,
          type: NotificationType.MENTION,
          content: `mentioned you in ${payload.channelName}`,
          link: `/channels/${payload.serverId}/${payload.channelId}`,
        });

        const saved = await this.notificationsRepo.save(notification);

        this.logger.log(
          `Notification is created for user : ${mentionendUser} with id : ${saved.id} `,
        );
        this.eventEmitter.emit('notification.created', { ...saved });
      }
    }
  }
}
