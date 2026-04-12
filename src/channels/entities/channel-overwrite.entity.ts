import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Channel } from './channel.entity';

@Entity('channel_overwrites')
export class ChannelOverwrite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  channelId: string;

  @ManyToOne(() => Channel, (channel) => channel.overwrites)
  channel: Channel;

  @Column()
  targetId: string; // Can be a Role UUID or a User UUID

  @Column({ type: 'varchar', length: 10 })
  targetType: 'role' | 'user';

  @Column({ type: 'varchar', length: 20, default: '0' })
  allow: string; // Bits to explicitly grant

  @Column({ type: 'varchar', length: 20, default: '0' })
  deny: string; // Bits to explicitly revoke
}
