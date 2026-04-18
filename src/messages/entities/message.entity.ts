import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('text')
  content!: string;

  @Column()
  authorId!: string;

  @Column()
  channelId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Channel)
  channel!: Channel;
}
