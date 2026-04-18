import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum NotificationType {
  DM = 'DM',
  MENTION = 'mention',
  FRIEND_REQUEST = 'friend_request',
  OTHER = 'other',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  recipientId!: string;
  @Column({ type: 'uuid' })
  senderId!: string;
  @Column({ type: 'uuid', nullable: true })
  serverId?: string;
  @Column({ type: 'uuid', nullable: true })
  channelId?: string;

  @Column({ type: 'varchar' })
  content!: string;
  @Column({ type: 'varchar' })
  link!: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type!: NotificationType;

  @Column({ default: false, type: 'boolean' })
  isRead!: boolean;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
