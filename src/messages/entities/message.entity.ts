import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import { MessageAttachment } from './message-attachment.entity';
import { MessageReaction } from './message-reaction.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('text')
  content!: string;

  @Column({ type: 'uuid' })
  authorId!: string;

  @Column({ type: 'uuid' })
  channelId!: string;

  @Column({ nullable: true })
  parentMessageId?: string;

  @Column({ nullable: true })
  threadRootMessageId?: string;

  @Column({ default: false })
  isDeleted!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Channel)
  channel!: Channel;

  @OneToMany(() => MessageAttachment, (attachment) => attachment.message)
  attachments!: MessageAttachment[];

  @OneToMany(() => MessageReaction, (reaction) => reaction.message)
  reactions!: MessageReaction[];
}
