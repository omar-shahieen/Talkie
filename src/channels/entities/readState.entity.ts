import { Column, Entity } from 'typeorm';

@Entity('read_states')
export class ReadState {
  @Column() userId!: string;
  @Column() channelId!: string;
  @Column() lastReadMessageId!: string; // The ID of the latest message they saw
  @Column() lastReadAt!: Date;
}
