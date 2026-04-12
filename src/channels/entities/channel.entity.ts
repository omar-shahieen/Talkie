import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChannelOverwrite } from './channel-overwrite.entity';
import { Server } from '../../servers/entities/server.entity';

@Entity('channels')
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  serverId: string;

  @ManyToOne(() => Server, (server) => server.channels)
  server: Server;

  @OneToMany(() => ChannelOverwrite, (overwrite) => overwrite.channel)
  overwrites: ChannelOverwrite[];
}
