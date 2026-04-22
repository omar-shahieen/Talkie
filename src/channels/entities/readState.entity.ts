import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('read_states')
export class ReadState {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ type: 'uuid' })
  channelId!: string;

  @Column({ type: 'uuid', nullable: true })
  lastReadMessageId!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastReadAt!: Date;
}
