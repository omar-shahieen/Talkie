import { Server } from 'src/servers/entities/server.entity';
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChannelOverwrite } from './channel-overwrite.entity';
import { ChannelMember } from './channel-member.entity';

export enum ChannelType {
  SERVER_TEXT = 'SERVER_TEXT',
  SERVER_VOICE = 'SERVER_VOICE',
  DM = 'DM',
}

@Entity('channels')
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: ChannelType,
    default: ChannelType.SERVER_TEXT,
  })
  type!: ChannelType;

  // SERVER ONLY COLUMNS (Nullable for DMs)
  @Column({ nullable: true })
  name?: string; // DMs don't have a name

  @Column({ nullable: true })
  serverId?: string;

  @ManyToOne(() => Server, { nullable: true })
  server?: Server;

  @OneToMany(() => ChannelOverwrite, (overwrite) => overwrite.channel)
  overwrites!: ChannelOverwrite[];

  // DM ONLY COLUMNS (Will be empty for Servers)
  @OneToMany(() => ChannelMember, (member) => member.channel)
  dmMembers!: ChannelMember[]; // The 2 people in the DM

  // SHARED COLUMNS
  @Column({ nullable: true, default: null })
  lastMessageId!: string | null; // For the "Bold" Unread feature
}
