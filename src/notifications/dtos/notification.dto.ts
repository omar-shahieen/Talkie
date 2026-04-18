import { NotificationType } from '../entities/notification.entity';

export type NotificationDto = {
  id: string;
  recipientId: string;
  senderId?: string;
  serverId?: string;
  channelId?: string;

  content: string;
  link: string;

  type: NotificationType;

  isRead: boolean;
  createdAt: Date;
};
