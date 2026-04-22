import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Channel } from './channel.entity';

@Entity('channel_members') // Specifically for DMs
@Unique(['channelId', 'userId'])
export class ChannelMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' }) channelId!: string;
  @Column({ type: 'uuid' }) userId!: string;

  @ManyToOne(() => Channel, (channel) => channel.dmMembers, {
    onDelete: 'CASCADE',
  })
  channel!: Channel;
}
